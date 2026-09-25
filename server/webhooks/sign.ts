import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const secretPrefix = "fs_whsec_";

export function generateWebhookSecret() {
  return `${secretPrefix}${randomBytes(24).toString("base64url")}`;
}

export function maskWebhookSecret(secret: string) {
  if (!secret.startsWith(secretPrefix)) {
    return "fs_whsec_********";
  }
  return `${secretPrefix}${"*".repeat(8)}`;
}

export function signWebhookPayload(secret: string, timestamp: number, rawBody: string) {
  const payload = `${timestamp}.${rawBody}`;
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

export function webhookSignatureHeader(secret: string, timestamp: number, rawBody: string) {
  const signature = signWebhookPayload(secret, timestamp, rawBody);
  return `t=${timestamp},v1=${signature}`;
}

export function verifyWebhookSignature(
  secret: string,
  header: string,
  rawBody: string,
  options: { nowSeconds?: number; maxSkewSeconds?: number } = {},
) {
  const nowSeconds = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const maxSkewSeconds = options.maxSkewSeconds ?? 300;
  const parts = Object.fromEntries(
    header
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const split = part.indexOf("=");
        return split < 0 ? [part, ""] : [part.slice(0, split), part.slice(split + 1)];
      }),
  ) as Record<string, string>;

  const timestamp = Number(parts.t);
  const signature = parts.v1;
  if (!Number.isFinite(timestamp) || !signature) {
    return false;
  }
  if (Math.abs(nowSeconds - timestamp) > maxSkewSeconds) {
    return false;
  }

  const expected = signWebhookPayload(secret, timestamp, rawBody);
  const left = Buffer.from(signature, "utf8");
  const right = Buffer.from(expected, "utf8");
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
