import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import * as schema from "../db/schema";
import { forms, submissionFiles, submissions } from "../db/schema";
import { deleteStoredObjects, deleteStoredPrefix, formUploadsPrefix } from "./storage";

export type DeleteDatabase = NodePgDatabase<typeof schema> | NeonDatabase<typeof schema>;

/**
 * Delete object storage for a submission, then the submission DB row.
 * Storage must succeed before the row is removed so retries remain safe.
 */
export async function deleteSubmissionWithStorage(
  database: DeleteDatabase,
  input: { formId: string; submissionId: string },
) {
  const files = await database
    .select({ storageKey: submissionFiles.storageKey })
    .from(submissionFiles)
    .where(
      and(eq(submissionFiles.formId, input.formId), eq(submissionFiles.submissionId, input.submissionId)),
    );

  try {
    await deleteStoredObjects(files.map((file) => file.storageKey));
  } catch {
    throw new Error("Could not delete submission files from storage. Try again.");
  }

  await database
    .delete(submissions)
    .where(and(eq(submissions.id, input.submissionId), eq(submissions.formId, input.formId)));
}

/**
 * Delete all objects under the form uploads prefix, then the form DB row.
 * Prefix cleanup is authoritative so orphaned objects without DB rows are removed too.
 * DB cascades handle submissions, submission_files, versions, and webhooks.
 */
export async function deleteFormWithStorage(database: DeleteDatabase, formId: string) {
  try {
    await deleteStoredPrefix(formUploadsPrefix(formId));
  } catch {
    throw new Error("Could not delete form files from storage. Try again.");
  }

  await database.delete(forms).where(eq(forms.id, formId));
}
