import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { forms } from "@/db/schema";
import { auth } from "@/lib/auth";

export async function requireUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    throw new Error("Not authenticated");
  }
  return session.user;
}

export async function requireFormOwner(formId: string, userId: string) {
  const form = await db.query.forms.findFirst({ where: eq(forms.id, formId) });
  if (!form || form.userId !== userId) {
    throw new Error("Form not found");
  }
  return form;
}
