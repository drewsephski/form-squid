import { and, asc, desc, eq, lte, lt, or } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { formVersions, submissions } from "@/db/schema";
import { requireFormOwner } from "@/app/lib/auth-guards";
import {
  csvDownloadFilename,
  csvReadableStream,
  submissionCsvChunks,
} from "@/app/lib/submission-csv";

const pageSize = 50;

function encodeCursor(createdAt: Date, id: string) {
  return `${createdAt.toISOString()}\t${id}`;
}

function decodeCursor(cursor: string | null) {
  if (!cursor) return null;
  const split = cursor.indexOf("\t");
  if (split < 0) return null;
  const createdAt = new Date(cursor.slice(0, split));
  const id = cursor.slice(split + 1);
  if (Number.isNaN(createdAt.getTime()) || !id) return null;
  return { createdAt, id };
}

function errorResponse(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ formId: string }> },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return errorResponse(401, "Not authenticated");

  const { formId } = await params;
  let form: Awaited<ReturnType<typeof requireFormOwner>>;
  try {
    form = await requireFormOwner(formId, session.user.id);
  } catch (error) {
    if (error instanceof Error && error.message === "Form not found") {
      return errorResponse(404, "Form not found");
    }
    throw error;
  }

  const versions = await db
    .select({ id: formVersions.id, versionNumber: formVersions.versionNumber, spec: formVersions.spec })
    .from(formVersions)
    .where(eq(formVersions.formId, formId))
    .orderBy(asc(formVersions.versionNumber));
  const [watermark] = await db
    .select({ id: submissions.id, createdAt: submissions.createdAt })
    .from(submissions)
    .where(eq(submissions.formId, formId))
    .orderBy(desc(submissions.createdAt), desc(submissions.id))
    .limit(1);

  return new Response(csvReadableStream((signal) => submissionCsvChunks({
    versions,
    watermark: watermark ?? null,
    signal,
    loadPage: async (cursor) => {
      if (!watermark) return { submissions: [], nextCursor: null };
      const decoded = decodeCursor(cursor);
      const rows = await db
        .select({
          id: submissions.id,
          formVersionId: submissions.formVersionId,
          payload: submissions.payload,
          createdAt: submissions.createdAt,
        })
        .from(submissions)
        .where(
          and(
            eq(submissions.formId, formId),
            or(
              lt(submissions.createdAt, watermark.createdAt),
              and(
                eq(submissions.createdAt, watermark.createdAt),
                lte(submissions.id, watermark.id),
              ),
            ),
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
      return {
        submissions: page,
        nextCursor: rows.length > pageSize && last ? encodeCursor(last.createdAt, last.id) : null,
      };
    },
  })), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": csvDownloadFilename(form.slug),
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
