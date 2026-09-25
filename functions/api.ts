import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { waitUntil } from "@neon/functions";
import { Hono } from "hono";
import { db } from "../db/function";
import { clientAddress, hashClientAddress, requireRateLimitSalt } from "../server/rate-limit";
import { submissionLog } from "../server/submission-log";
import { submitForm } from "../server/submit-form";
import { deliverSubmissionWebhook } from "../server/webhooks/deliver";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "X-Request-Id",
};

const salt = requireRateLimitSalt(process.env.RATE_LIMIT_IP_SALT);

const noStore = { "Cache-Control": "no-store" };

const app = new Hono();

app.get("/", (c) =>
  c.json(
    {
      ok: true,
      service: "FormSquid API",
      version: "v1",
      health: "/health",
      ready: "/ready",
    },
    200,
    noStore,
  ),
);

app.get("/health", (c) => c.json({ ok: true }, 200, noStore));

app.get("/ready", async (c) => {
  try {
    await db.execute(sql`SELECT 1`);
    return c.json({ ok: true }, 200, noStore);
  } catch {
    return c.json({ ok: false }, 503, noStore);
  }
});

app.options("/forms/:slug/submissions", (c) => {
  return c.body(null, 204, corsHeaders);
});

app.post("/forms/:slug/submissions", async (c) => {
  const requestId = randomUUID();
  const started = Date.now();
  const headers: Record<string, string> = { ...corsHeaders, "X-Request-Id": requestId };
  const actorHash = hashClientAddress(clientAddress(c.req.header("x-forwarded-for")), salt);

  try {
    const result = await submitForm(db, {
      slug: c.req.param("slug"),
      rawBody: await c.req.text(),
      actorHash,
    });
    console.log(
      submissionLog({
        event: result.event,
        requestId,
        formId: result.formId,
        durationMs: Date.now() - started,
        status: result.status,
        reason: result.reason,
      }),
    );
    if (result.dispatch) {
      waitUntil(
        deliverSubmissionWebhook(db, result.dispatch).catch((error: unknown) => {
          console.error("webhook delivery failed", error instanceof Error ? error.message : "unknown");
        }),
      );
    }
    if (result.retryAfter) headers["Retry-After"] = String(result.retryAfter);
    return c.json(result.body, result.status, headers);
  } catch {
    console.log(
      submissionLog({
        event: "submission.failed",
        requestId,
        formId: null,
        durationMs: Date.now() - started,
        status: 500,
        reason: "exception",
      }),
    );
    return c.json({ ok: false, error: "Could not submit. Try again." }, 500, headers);
  }
});

export default app;
