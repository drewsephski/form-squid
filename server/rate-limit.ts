import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { maxSubmissionAttemptsPerMinute } from "../app/lib/definitions";
import * as schema from "../db/schema";
import { submissionRateBuckets } from "../db/schema";

type RateLimitDatabase = NodePgDatabase<typeof schema>;

export function bucketStart(now: Date) {
  const start = new Date(now);
  start.setUTCSeconds(0, 0);
  return start;
}

export function requireRateLimitSalt(value: string | undefined) {
  if (!value) {
    throw new Error("RATE_LIMIT_IP_SALT is required");
  }
  return value;
}

export function clientAddress(forwardedFor: string | undefined) {
  const last = forwardedFor?.split(",").map((part) => part.trim()).filter(Boolean).at(-1) ?? "";
  if (!last || last.length > 128) return "unknown";
  return last;
}

export function hashClientAddress(address: string, salt: string) {
  return createHash("sha256").update(`${salt}\0${address}`).digest("hex");
}

export async function reserveSubmissionAttempt(
  database: RateLimitDatabase,
  input: { formId: string; actorHash: string; now: Date },
) {
  const start = bucketStart(input.now);
  const [row] = await database
    .insert(submissionRateBuckets)
    .values({
      formId: input.formId,
      actorHash: input.actorHash,
      bucketStart: start,
      attempts: 1,
    })
    .onConflictDoUpdate({
      target: [submissionRateBuckets.formId, submissionRateBuckets.actorHash, submissionRateBuckets.bucketStart],
      set: { attempts: sql`${submissionRateBuckets.attempts} + 1` },
    })
    .returning({ attempts: submissionRateBuckets.attempts });

  const attempts = row?.attempts ?? 1;
  const retryAfter = Math.max(1, 60 - input.now.getUTCSeconds());
  return {
    allowed: attempts <= maxSubmissionAttemptsPerMinute,
    attempts,
    retryAfter,
  };
}
