import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export type WebhookUrlPolicy = {
  /** Only for local development and tests. Never enable in production. */
  allowLoopback: boolean;
};

export function webhookUrlPolicyFromEnv(env: NodeJS.ProcessEnv = process.env): WebhookUrlPolicy {
  return { allowLoopback: env.NODE_ENV !== "production" };
}

export class WebhookUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookUrlError";
  }
}

function parseIpv4(address: string) {
  const parts = address.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return ((parts[0]! << 24) >>> 0) + ((parts[1]! << 16) >>> 0) + ((parts[2]! << 8) >>> 0) + parts[3]!;
}

function ipv4InCidr(address: string, base: string, bits: number) {
  const ip = parseIpv4(address);
  const network = parseIpv4(base);
  if (ip === null || network === null) {
    return false;
  }
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ip & mask) === (network & mask);
}

export function isDisallowedIpv4(address: string) {
  return (
    ipv4InCidr(address, "0.0.0.0", 8) ||
    ipv4InCidr(address, "10.0.0.0", 8) ||
    ipv4InCidr(address, "100.64.0.0", 10) ||
    ipv4InCidr(address, "127.0.0.0", 8) ||
    ipv4InCidr(address, "169.254.0.0", 16) ||
    ipv4InCidr(address, "172.16.0.0", 12) ||
    ipv4InCidr(address, "192.168.0.0", 16) ||
    ipv4InCidr(address, "198.18.0.0", 15) ||
    ipv4InCidr(address, "224.0.0.0", 4) ||
    ipv4InCidr(address, "240.0.0.0", 4)
  );
}

function expandIpv6(address: string) {
  const lower = address.toLowerCase();
  const [head, tail = ""] = lower.split("::");
  const headParts = head ? head.split(":") : [];
  const tailParts = tail ? tail.split(":") : [];
  const missing = 8 - (headParts.length + tailParts.length);
  const parts = [...headParts, ...Array.from({ length: Math.max(missing, 0) }, () => "0"), ...tailParts];
  if (parts.length !== 8) {
    return null;
  }
  return parts.map((part) => part.padStart(4, "0"));
}

export function isDisallowedIpv6(address: string) {
  const lower = address.toLowerCase();
  if (lower === "::" || lower === "::1") {
    return true;
  }
  if (lower.startsWith("::ffff:")) {
    const mapped = lower.slice("::ffff:".length);
    if (isIP(mapped) === 4) {
      return isDisallowedIpv4(mapped);
    }
  }

  const parts = expandIpv6(lower);
  if (!parts) {
    return true;
  }

  const first = Number.parseInt(parts[0]!, 16);
  // Unique-local fc00::/7
  if ((first & 0xfe00) === 0xfc00) {
    return true;
  }
  // Link-local fe80::/10
  if ((first & 0xffc0) === 0xfe80) {
    return true;
  }
  // Multicast ff00::/8
  if ((first & 0xff00) === 0xff00) {
    return true;
  }
  // Loopback ::1
  if (parts.every((part, index) => (index === 7 ? part === "0001" : part === "0000"))) {
    return true;
  }
  return false;
}

export function isDisallowedIp(address: string) {
  const version = isIP(address);
  if (version === 4) {
    return isDisallowedIpv4(address);
  }
  if (version === 6) {
    return isDisallowedIpv6(address);
  }
  return true;
}

function isLocalHostname(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return host === "localhost" || host.endsWith(".localhost") || host === "metadata.google.internal";
}

export async function assertSafeWebhookUrl(
  rawUrl: string,
  policy: WebhookUrlPolicy = webhookUrlPolicyFromEnv(),
  resolve: (hostname: string) => Promise<string[]> = resolveHostnameAddresses,
) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new WebhookUrlError("Enter a valid webhook URL.");
  }

  if (parsed.username || parsed.password) {
    throw new WebhookUrlError("Webhook URLs must not include credentials.");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  const localHost = isLocalHostname(hostname);
  const literalIp = isIP(hostname);

  if (policy.allowLoopback) {
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new WebhookUrlError("Webhook URLs must use HTTPS.");
    }
    if (localHost || (literalIp && isLoopbackAddress(hostname))) {
      return parsed;
    }
    if (parsed.protocol !== "https:") {
      throw new WebhookUrlError("Webhook URLs must use HTTPS.");
    }
  } else if (parsed.protocol !== "https:") {
    throw new WebhookUrlError("Webhook URLs must use HTTPS.");
  }

  if (localHost) {
    throw new WebhookUrlError("Webhook URLs cannot target localhost.");
  }

  if (literalIp) {
    if (isDisallowedIp(hostname)) {
      throw new WebhookUrlError("Webhook URLs cannot target private or local addresses.");
    }
    return parsed;
  }

  const addresses = await resolve(hostname);
  if (addresses.length === 0) {
    throw new WebhookUrlError("Could not resolve the webhook hostname.");
  }

  const disallowed = addresses.filter((address) => isDisallowedIp(address));
  if (disallowed.length > 0) {
    const onlyLoopback =
      policy.allowLoopback &&
      disallowed.length === addresses.length &&
      disallowed.every((address) => isLoopbackAddress(address));
    if (!onlyLoopback) {
      throw new WebhookUrlError("Webhook URLs cannot target private or local addresses.");
    }
  }

  return parsed;
}

function isLoopbackAddress(address: string) {
  if (isIP(address) === 4) {
    return ipv4InCidr(address, "127.0.0.0", 8);
  }
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    return lower === "::1" || lower === "0:0:0:0:0:0:0:1";
  }
  return false;
}

async function resolveHostnameAddresses(hostname: string) {
  const records = await lookup(hostname, { all: true, verbatim: true });
  return records.map((record) => record.address);
}
