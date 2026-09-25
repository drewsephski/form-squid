"use server";

import { and, count, desc, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { formVersions, forms, submissions } from "@/db/schema";
import { formSpecSchema } from "@/app/lib/definitions";
import { hostedHost } from "@/app/lib/origin";
import { requireFormOwner, requireUser } from "@/app/lib/auth-guards";

const pageSize = 50;

export type SubmissionRow = {
  id: string;
  formVersionId: string;
  payload: unknown;
  createdAt: string;
};

function encodeCursor(createdAt: Date, id: string) {
  return `${createdAt.toISOString()}\t${id}`;
}

function decodeCursor(cursor: string) {
  const split = cursor.indexOf("\t");
  if (split < 0) {
    return null;
  }
  const createdAt = new Date(cursor.slice(0, split));
  const id = cursor.slice(split + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) {
    return null;
  }
  return { createdAt, id };
}

async function pageSubmissions(formId: string, cursor?: string) {
  const decoded = cursor ? decodeCursor(cursor) : null;
  const rows = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.formId, formId),
        decoded
          ? or(
              lt(submissions.createdAt, decoded.createdAt),
              and(eq(submissions.createdAt, decoded.createdAt), lt(submissions.id, decoded.id)),
            )
          : undefined,
      ),
    )
    .orderBy(desc(submissions.createdAt), desc(submissions.id))
    .limit(pageSize + 1);

  const page = rows.slice(0, pageSize);
  const last = page.at(-1);
  const nextCursor = rows.length > pageSize && last ? encodeCursor(last.createdAt, last.id) : null;
  return {
    submissions: page.map((row) => ({
      id: row.id,
      formVersionId: row.formVersionId,
      payload: row.payload,
      createdAt: row.createdAt.toISOString(),
    })),
    nextCursor,
  };
}

export async function listForms() {
  const user = await requireUser();
  const rows = await db.select().from(forms).where(eq(forms.userId, user.id)).orderBy(desc(forms.updatedAt));
  const ids = rows.map((row) => row.id);
  const totals =
    ids.length === 0
      ? []
      : await db
          .select({ formId: submissions.formId, total: count() })
          .from(submissions)
          .where(inArray(submissions.formId, ids))
          .groupBy(submissions.formId);
  const counts = new Map(totals.map((row) => [row.formId, row.total]));

  return rows.map((row) => {
    const spec = formSpecSchema.safeParse(row.draftSpec);
    return {
      id: row.id,
      title: spec.success ? spec.data.title : row.slug,
      preview: spec.success ? spec.data : null,
      slug: row.slug,
      host: hostedHost(row.slug),
      published: Boolean(row.currentPublishedVersionId),
      responses: counts.get(row.id) ?? 0,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function getForm(formId: string) {
  const user = await requireUser();
  const form = await requireFormOwner(formId, user.id);
  const versions = await db
    .select()
    .from(formVersions)
    .where(eq(formVersions.formId, formId))
    .orderBy(desc(formVersions.versionNumber));
  const page = await pageSubmissions(formId);
  const published = versions.find((version) => version.id === form.currentPublishedVersionId);
  const publishedSpec = published ? formSpecSchema.safeParse(published.spec) : null;

  return {
    id: form.id,
    slug: form.slug,
    draftSlug: form.draftSlug,
    notifyEmail: form.notifyEmail ?? "",
    registryKey: form.registryKey,
    draftSpec: formSpecSchema.parse(form.draftSpec),
    publishedVersionId: form.currentPublishedVersionId,
    publishedSpec: publishedSpec?.success ? publishedSpec.data : null,
    publishedAt: published?.createdAt.toISOString() ?? null,
    versions: versions.map((version) => {
      const parsed = formSpecSchema.safeParse(version.spec);
      return {
        id: version.id,
        versionNumber: version.versionNumber,
        createdAt: version.createdAt.toISOString(),
        spec: parsed.success ? parsed.data : null,
      };
    }),
    submissions: page.submissions,
    nextCursor: page.nextCursor,
  };
}

export async function loadSubmissions(formId: string, cursor: string) {
  const user = await requireUser();
  await requireFormOwner(formId, user.id);
  return pageSubmissions(formId, cursor);
}

function csvCell(value: unknown) {
  const text = value === undefined || value === null ? "" : typeof value === "string" ? value : JSON.stringify(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportSubmissionsCsv(formId: string) {
  const user = await requireUser();
  await requireFormOwner(formId, user.id);
  const rows: SubmissionRow[] = [];
  let cursor: string | null = null;
  do {
    const page = await pageSubmissions(formId, cursor ?? undefined);
    rows.push(...page.submissions);
    cursor = page.nextCursor;
  } while (cursor);

  const keys = [...new Set(rows.flatMap((row) => Object.keys((row.payload as Record<string, unknown>) ?? {})))];
  const header = ["submitted", ...keys].map((key) => csvCell(key)).join(",");
  const body = rows
    .map((row) => {
      const payload = (row.payload as Record<string, unknown>) ?? {};
      return [csvCell(row.createdAt), ...keys.map((key) => csvCell(payload[key]))].join(",");
    })
    .join("\n");
  return [header, body].filter(Boolean).join("\n");
}
