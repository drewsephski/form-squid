import { randomUUID } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Resend } from "resend";
import {
  formSpecSchema,
  honeypotField,
  maxSubmissionBytes,
  maxSubmissionsPerDay,
  type SubmissionError,
} from "../app/lib/definitions";
import { appOrigin } from "../app/lib/origin";
import { labeledAnswers } from "../app/lib/submission-display";
import { validateSubmission } from "../app/lib/validate-submission";
import * as schema from "../db/schema";
import { formVersions, forms, submissions } from "../db/schema";
import { senderAddress, submissionNotificationEmail } from "./mail";
import { reserveSubmissionAttempt } from "./rate-limit";
import type { SubmissionEvent } from "./submission-log";
import { attachUploadsToSubmission } from "./uploads";
import type { SubmissionDispatch } from "./webhooks/payload";

export type SubmitDatabase = NodePgDatabase<typeof schema>;

type SubmitBody =
  | { ok: true }
  | { ok: false; error: string }
  | { ok: false; errors: SubmissionError[] };

export type SubmitResponse = {
  status: 200 | 400 | 404 | 413 | 429;
  body: SubmitBody;
  event: SubmissionEvent;
  formId: string | null;
  reason: string;
  retryAfter?: number;
  dispatch?: SubmissionDispatch;
};

function respond(
  status: SubmitResponse["status"],
  body: SubmitBody,
  event: SubmissionEvent,
  reason: string,
  formId: string | null = null,
  retryAfter?: number,
): SubmitResponse {
  return { status, body, event, formId, reason, ...(retryAfter ? { retryAfter } : {}) };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function submitForm(
  database: SubmitDatabase,
  input: { slug: string; rawBody: string; actorHash: string; now?: Date },
): Promise<SubmitResponse> {
  const now = input.now ?? new Date();
  if (Buffer.byteLength(input.rawBody, "utf8") > maxSubmissionBytes) {
    return respond(413, { ok: false, error: "Submission is too large." }, "submission.invalid", "too_large");
  }

  const [form] = await database.select().from(forms).where(eq(forms.slug, input.slug));
  if (!form?.currentPublishedVersionId) {
    return respond(404, { ok: false, error: "Form not found." }, "submission.not_found", "missing_form");
  }

  const rate = await reserveSubmissionAttempt(database, {
    formId: form.id,
    actorHash: input.actorHash,
    now,
  });
  if (!rate.allowed) {
    return respond(
      429,
      { ok: false, error: "Too many attempts. Try again in a minute." },
      "submission.rate_limited",
      "attempt_window",
      form.id,
      rate.retryAfter,
    );
  }

  let body: unknown = {};
  try {
    body = input.rawBody ? JSON.parse(input.rawBody) : {};
  } catch {
    return respond(400, { ok: false, error: "Expected JSON." }, "submission.invalid", "expected_json", form.id);
  }

  if (!isJsonObject(body)) {
    return respond(400, { ok: false, error: "Expected a JSON object." }, "submission.invalid", "expected_object", form.id);
  }

  const honeypot = body[honeypotField];
  delete body[honeypotField];
  if (typeof honeypot === "string" && honeypot.trim()) {
    return respond(200, { ok: true }, "submission.accepted", "honeypot", form.id);
  }

  const [version] = await database
    .select()
    .from(formVersions)
    .where(eq(formVersions.id, form.currentPublishedVersionId));
  if (!version) {
    return respond(404, { ok: false, error: "Form not found." }, "submission.not_found", "missing_version", form.id);
  }

  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [countRow] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(submissions)
    .where(and(eq(submissions.formId, form.id), gte(submissions.createdAt, since)));
  if ((countRow?.count ?? 0) >= maxSubmissionsPerDay) {
    return respond(
      429,
      { ok: false, error: "This form is not accepting submissions right now." },
      "submission.rate_limited",
      "daily_cap",
      form.id,
    );
  }

  const spec = formSpecSchema.parse(version.spec);
  const result = validateSubmission(spec, body);
  if (!result.ok) {
    return respond(400, { ok: false, errors: result.errors }, "submission.invalid", "validation", form.id);
  }

  const submissionId = randomUUID();
  let storedData = result.data;

  const fileFieldIds = new Set(
    spec.steps.flatMap((step) => step.fields).filter((field) => field.type === "file").map((field) => field.id),
  );
  const needsUploadAttach = Object.keys(result.data).some((key) => fileFieldIds.has(key));

  try {
    if (needsUploadAttach) {
      storedData = await database.transaction(async (tx) => {
        const attached = await attachUploadsToSubmission(tx, {
          formId: form.id,
          submissionId,
          actorHash: input.actorHash,
          spec,
          data: result.data,
        });
        if (!attached.ok) {
          throw Object.assign(new Error("upload_attach_failed"), { errors: attached.errors });
        }

        await tx.insert(submissions).values({
          id: submissionId,
          formId: form.id,
          formVersionId: version.id,
          payload: attached.data,
          createdAt: now,
        });

        return attached.data;
      });
    } else {
      await database.insert(submissions).values({
        id: submissionId,
        formId: form.id,
        formVersionId: version.id,
        payload: result.data,
        createdAt: now,
      });
    }
  } catch (error) {
    if (error && typeof error === "object" && "errors" in error) {
      return respond(
        400,
        { ok: false, errors: (error as { errors: SubmissionError[] }).errors },
        "submission.invalid",
        "upload_attach",
        form.id,
      );
    }
    throw error;
  }

  if (process.env.RESEND_API_KEY && form.notifyEmail) {
    try {
      const message = submissionNotificationEmail({
        formTitle: spec.title || input.slug,
        answers: labeledAnswers(spec, storedData),
        inboxUrl: `${appOrigin()}/forms/${form.id}`,
      });
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({
        from: senderAddress("RESEND_FROM"),
        to: form.notifyEmail,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    } catch (error) {
      console.error("submission notification failed", error);
    }
  }

  return {
    ...respond(200, { ok: true }, "submission.accepted", "stored", form.id),
    dispatch: {
      submissionId,
      formId: form.id,
      formSlug: form.slug,
      formTitle: spec.title || form.slug,
      version: version.versionNumber,
      createdAt: now.toISOString(),
      data: storedData,
    },
  };
}
