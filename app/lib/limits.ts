import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { generationEvents, submissions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { maxSubmissionsPerDay } from "./definitions";

export async function consumeGeneration() {
  const session = await auth.api.getSession({ headers: await headers() });
  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const actorKey = session?.user
    ? `user:${session.user.id}`
    : `ip:${createHash("sha256").update(`${ip}:${process.env.BETTER_AUTH_SECRET ?? ""}`).digest("hex")}`;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(generationEvents)
    .where(and(eq(generationEvents.actorKey, actorKey), gte(generationEvents.createdAt, since)));

  if ((row?.count ?? 0) >= 30) {
    throw new Error("Daily generation limit reached.");
  }

  await db.insert(generationEvents).values({ id: randomUUID(), actorKey });
}

export async function submissionCountToday(formId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(submissions)
    .where(and(eq(submissions.formId, formId), gte(submissions.createdAt, since)));
  return row?.count ?? 0;
}

export function overSubmissionCeiling(count: number) {
  return count >= maxSubmissionsPerDay;
}
