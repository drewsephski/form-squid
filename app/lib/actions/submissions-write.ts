"use server";

import { db } from "@/db";
import { requireFormOwner, requireUser } from "@/app/lib/auth-guards";
import { deleteSubmissionWithStorage } from "@/server/delete-lifecycle";

export async function deleteSubmission(formId: string, submissionId: string) {
  const user = await requireUser();
  await requireFormOwner(formId, user.id);
  await deleteSubmissionWithStorage(db, { formId, submissionId });
}
