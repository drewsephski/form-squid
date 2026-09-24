import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { formVersions, forms, submissions } from "@/db/schema";
import { formSpecSchema } from "@/app/lib/definitions";
import { requireFormOwner, requireUser } from "@/app/lib/auth-guards";

export async function getForm(formId: string) {
  const user = await requireUser();
  const form = await requireFormOwner(formId, user.id);
  const versions = await db
    .select()
    .from(formVersions)
    .where(eq(formVersions.formId, formId))
    .orderBy(desc(formVersions.versionNumber));
  const rows = await db
    .select()
    .from(submissions)
    .where(eq(submissions.formId, formId))
    .orderBy(desc(submissions.createdAt));

  return {
    id: form.id,
    slug: form.slug,
    notifyEmail: form.notifyEmail ?? "",
    registryKey: form.registryKey,
    draftSpec: formSpecSchema.parse(form.draftSpec),
    publishedVersionId: form.currentPublishedVersionId,
    versions: versions.map((version) => ({
      id: version.id,
      versionNumber: version.versionNumber,
      createdAt: version.createdAt.toISOString(),
    })),
    submissions: rows.map((row) => ({
      id: row.id,
      formVersionId: row.formVersionId,
      payload: row.payload,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
