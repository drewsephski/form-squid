import { Resend } from "resend";

const testSender = "onboarding@resend.dev";

export function isProductionMailRuntime() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export function senderAddress(name: "RESEND_FROM" | "RESEND_AUTH_FROM") {
  const configured = process.env[name]?.trim() ?? "";
  const developmentFallback = name === "RESEND_AUTH_FROM" ? (process.env.RESEND_FROM?.trim() ?? "") : "";
  const value = configured || (isProductionMailRuntime() ? "" : developmentFallback);

  if (!value) {
    throw new Error(`${name} is required${isProductionMailRuntime() ? " in production" : ""}.`);
  }
  if (isProductionMailRuntime() && value.includes(testSender)) {
    throw new Error(`${name} cannot use the Resend test sender in production.`);
  }
  return value;
}

export async function sendAuthEmail(input: { to: string; subject: string; text: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required.");
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: senderAddress("RESEND_AUTH_FROM"),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
  if (result.error) {
    throw new Error(result.error.message);
  }
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function passwordResetEmail(url: string) {
  const text = [
    "Reset your FormSquid password.",
    "",
    url,
    "",
    "This link expires in one hour. If you did not ask for a reset, you can ignore this email.",
  ].join("\n");
  const html = `<p>Reset your FormSquid password.</p><p><a href="${escapeHtml(url)}">Choose a new password</a></p><p>This link expires in one hour. If you did not ask for a reset, you can ignore this email.</p>`;
  return {
    subject: "Reset your FormSquid password",
    text,
    html,
  };
}

export function submissionNotificationEmail(input: {
  formTitle: string;
  answers: Array<{ label: string; value: string }>;
  inboxUrl: string;
}) {
  const title = input.formTitle.trim() || "your form";
  const subject = `New response on ${title}`;
  const rows = input.answers.map((answer) => `${answer.label}: ${answer.value}`);
  const text = [
    subject,
    "",
    ...rows,
    "",
    "View this response in FormSquid:",
    input.inboxUrl,
  ].join("\n");

  const answerHtml = input.answers
    .map(
      (answer) =>
        `<tr><td style="padding:8px 12px 8px 0;color:#667085;vertical-align:top;white-space:nowrap;">${escapeHtml(answer.label)}</td><td style="padding:8px 0;color:#101828;vertical-align:top;">${escapeHtml(answer.value).replace(/\n/g, "<br>")}</td></tr>`,
    )
    .join("");

  const html = [
    `<p style="margin:0 0 16px;font-size:16px;color:#101828;">${escapeHtml(subject)}</p>`,
    `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:560px;">${answerHtml}</table>`,
    `<p style="margin:20px 0 0;font-size:14px;"><a href="${escapeHtml(input.inboxUrl)}">View in FormSquid</a></p>`,
  ].join("");

  return { subject, text, html };
}
