import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { waitUntil } from "@neon/functions";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/function";
import { clientAddress, hashClientAddress, requireRateLimitSalt } from "../server/rate-limit";
import { submissionLog } from "../server/submission-log";
import { submitForm } from "../server/submit-form";
import { authorizeUpload } from "../server/uploads";
import { deliverSubmissionWebhook } from "../server/webhooks/deliver";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Expose-Headers": "X-Request-Id",
};

const salt = requireRateLimitSalt(process.env.RATE_LIMIT_IP_SALT);

const noStore = { "Cache-Control": "no-store" };

const uploadBodySchema = z.object({
  fieldId: z.string().min(1).max(64),
  filename: z.string().min(1).max(500),
  contentType: z.string().min(1).max(200),
  size: z.number().int().positive().max(100 * 1024 * 1024),
});

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

app.options("/forms/:slug/uploads", (c) => {
  return c.body(null, 204, corsHeaders);
});

app.post("/forms/:slug/uploads", async (c) => {
  const requestId = randomUUID();
  const headers: Record<string, string> = { ...corsHeaders, "X-Request-Id": requestId };
  const actorHash = hashClientAddress(clientAddress(c.req.header("x-forwarded-for")), salt);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "Expected JSON." }, 400, headers);
  }

  const parsed = uploadBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: "Invalid upload request." }, 400, headers);
  }

  try {
    const result = await authorizeUpload(db, {
      slug: c.req.param("slug"),
      actorHash,
      fieldId: parsed.data.fieldId,
      filename: parsed.data.filename,
      contentType: parsed.data.contentType,
      size: parsed.data.size,
    });
    if (!result.ok) {
      if (result.retryAfter) headers["Retry-After"] = String(result.retryAfter);
      return c.json(result.body, result.status, headers);
    }
    return c.json({ ok: true, ...result.body }, 200, headers);
  } catch (error) {
    console.error("upload authorize failed", error instanceof Error ? error.message : "unknown");
    return c.json({ ok: false, error: "Could not authorize upload. Try again." }, 500, headers);
  }
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
