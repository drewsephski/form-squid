import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { Resend } from "resend";
import { db } from "@/db";
import { submissions } from "@/db/schema";
import { honeypotField, maxSubmissionBytes } from "@/app/lib/definitions";
import { overSubmissionCeiling, submissionCountToday } from "@/app/lib/limits";
import { getPublishedForm } from "@/app/lib/published";
import { validateSubmission } from "@/app/lib/validate-submission";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const text = await request.text();
  if (text.length > maxSubmissionBytes) {
    return NextResponse.json({ ok: false, error: "Submission is too large." }, { status: 413, headers: corsHeaders });
  }

  let body: Record<string, unknown> = {};
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ ok: false, error: "Expected JSON." }, { status: 400, headers: corsHeaders });
  }

  const honeypot = body[honeypotField];
  delete body[honeypotField];
  if (typeof honeypot === "string" && honeypot.trim()) {
    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  }

  const published = await getPublishedForm(slug);
  if (!published) {
    return NextResponse.json({ ok: false, error: "Form not found." }, { status: 404, headers: corsHeaders });
  }

  if (overSubmissionCeiling(await submissionCountToday(published.id))) {
    return NextResponse.json({ ok: false, error: "This form is not accepting submissions right now." }, { status: 429, headers: corsHeaders });
  }

  const result = validateSubmission(published.spec, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, errors: result.errors }, { status: 400, headers: corsHeaders });
  }

  await db.insert(submissions).values({
    id: randomUUID(),
    formId: published.id,
    formVersionId: published.versionId,
    payload: result.data,
  });

  if (process.env.RESEND_API_KEY && published.notifyEmail) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails
      .send({
        from: process.env.RESEND_FROM ?? "FormSquid <onboarding@resend.dev>",
        to: published.notifyEmail,
        subject: `New submission for ${slug}`,
        text: JSON.stringify(result.data, null, 2),
      })
      .catch(() => undefined);
  }

  return NextResponse.json({ ok: true }, { headers: corsHeaders });
}
