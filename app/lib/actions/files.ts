"use server";

import { requireFormOwner, requireUser } from "@/app/lib/auth-guards";
import { db } from "@/db";
import { signedDownloadForOwner } from "@/server/uploads";

export async function createSubmissionFileDownload(formId: string, fileId: string) {
  const user = await requireUser();
  await requireFormOwner(formId, user.id);
  const result = await signedDownloadForOwner(db, { formId, userId: user.id, fileId });
  if (!result) {
    throw new Error("File not found.");
  }
  return result;
}
