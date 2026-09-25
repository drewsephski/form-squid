import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/function";
import { clientAddress, hashClientAddress } from "../server/rate-limit";
import { submissionLog } from "../server/submission-log";
import { submitForm } from "../server/submit-form";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "X-Request-Id",
};

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

app.get("/ready", async (c) => {
  try {
    await db.execute(sql`SELECT 1`);
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false }, 503);
  }
});

app.options("/forms/:slug/submissions", (c) => {
  return c.body(null, 204, corsHeaders);
});

app.post("/forms/:slug/submissions", async (c) => {
  const requestId = randomUUID();
  const started = Date.now();
  const headers: Record<string, string> = { ...corsHeaders, "X-Request-Id": requestId };
  const salt = process.env.RATE_LIMIT_IP_SALT ?? "";
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
