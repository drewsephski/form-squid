"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { submissions } from "@/db/schema";
import { requireFormOwner, requireUser } from "@/app/lib/auth-guards";

export async function deleteSubmission(formId: string, submissionId: string) {
  const user = await requireUser();
  await requireFormOwner(formId, user.id);
  await db.delete(submissions).where(and(eq(submissions.id, submissionId), eq(submissions.formId, formId)));
}
