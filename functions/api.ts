import { Hono } from "hono";
import { db } from "../db/function";
import { submitForm } from "../server/submit-form";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

app.options("/forms/:slug/submissions", (c) => {
  return c.body(null, 204, corsHeaders);
});

app.post("/forms/:slug/submissions", async (c) => {
  const result = await submitForm(db, {
    slug: c.req.param("slug"),
    rawBody: await c.req.text(),
  });
  return c.json(result.body, result.status, corsHeaders);
});

export default app;
