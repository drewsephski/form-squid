import { randomUUID } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Resend } from "resend";
import {
  formSpecSchema,
  honeypotField,
  maxSubmissionBytes,
  maxSubmissionsPerDay,
  type SubmissionError,
} from "../app/lib/definitions";
import { validateSubmission } from "../app/lib/validate-submission";
import * as schema from "../db/schema";
import { formVersions, forms, submissions } from "../db/schema";

export type SubmitDatabase = NeonDatabase<typeof schema> | NodePgDatabase<typeof schema>;

export type SubmitResponse =
  | { status: 200; body: { ok: true } }
  | { status: 400; body: { ok: false; error: string } | { ok: false; errors: SubmissionError[] } }
  | { status: 404; body: { ok: false; error: string } }
  | { status: 413; body: { ok: false; error: string } }
  | { status: 429; body: { ok: false; error: string } };

export async function submitForm(
  database: SubmitDatabase,
  input: { slug: string; rawBody: string },
): Promise<SubmitResponse> {
  if (input.rawBody.length > maxSubmissionBytes) {
    return { status: 413, body: { ok: false, error: "Submission is too large." } };
  }

  let body: Record<string, unknown> = {};
  try {
    body = input.rawBody ? (JSON.parse(input.rawBody) as Record<string, unknown>) : {};
  } catch {
    return { status: 400, body: { ok: false, error: "Expected JSON." } };
  }

  const honeypot = body[honeypotField];
  delete body[honeypotField];
  if (typeof honeypot === "string" && honeypot.trim()) {
    return { status: 200, body: { ok: true } };
  }

  const [form] = await database.select().from(forms).where(eq(forms.slug, input.slug));
  if (!form?.currentPublishedVersionId) {
    return { status: 404, body: { ok: false, error: "Form not found." } };
  }

  const [version] = await database
    .select()
    .from(formVersions)
    .where(eq(formVersions.id, form.currentPublishedVersionId));
  if (!version) {
    return { status: 404, body: { ok: false, error: "Form not found." } };
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [countRow] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(submissions)
    .where(and(eq(submissions.formId, form.id), gte(submissions.createdAt, since)));
  if ((countRow?.count ?? 0) >= maxSubmissionsPerDay) {
    return { status: 429, body: { ok: false, error: "This form is not accepting submissions right now." } };
  }

  const spec = formSpecSchema.parse(version.spec);
  const result = validateSubmission(spec, body);
  if (!result.ok) {
    return { status: 400, body: { ok: false, errors: result.errors } };
  }

  await database.insert(submissions).values({
    id: randomUUID(),
    formId: form.id,
    formVersionId: version.id,
    payload: result.data,
  });

  if (process.env.RESEND_API_KEY && form.notifyEmail) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails
      .send({
        from: process.env.RESEND_FROM ?? "FormSquid <onboarding@resend.dev>",
        to: form.notifyEmail,
        subject: `New submission for ${input.slug}`,
        text: JSON.stringify(result.data, null, 2),
      })
      .catch(() => undefined);
  }

  return { status: 200, body: { ok: true } };
}
