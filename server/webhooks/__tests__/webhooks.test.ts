import { describe, expect, test } from "@jest/globals";
import {
  generateWebhookSecret,
  signWebhookPayload,
  verifyWebhookSignature,
  webhookSignatureHeader,
} from "../sign";
import {
  assertSafeWebhookUrl,
  isDisallowedIpv4,
  isDisallowedIpv6,
  WebhookUrlError,
} from "../ssrf";
import { buildWebhookPayload, sampleSubmissionData, submissionCreatedEvent } from "../payload";
import { assertWebhookOwnedByForm } from "../deliver";

describe("webhook signatures", () => {
  test("HMAC signature is deterministic for the same inputs", () => {
    const secret = "fs_whsec_testsecret";
    const body = '{"ok":true}';
    const left = signWebhookPayload(secret, 1_700_000_000, body);
    const right = signWebhookPayload(secret, 1_700_000_000, body);
    expect(left).toBe(right);
    expect(left).toMatch(/^[a-f0-9]{64}$/);
  });

  test("changing the secret changes the signature", () => {
    const body = '{"ok":true}';
    const left = signWebhookPayload("fs_whsec_a", 1_700_000_000, body);
    const right = signWebhookPayload("fs_whsec_b", 1_700_000_000, body);
    expect(left).not.toBe(right);
  });

  test("verification uses timing-safe comparison", () => {
    const secret = generateWebhookSecret();
    expect(secret.startsWith("fs_whsec_")).toBe(true);
    const body = JSON.stringify({ hello: "world" });
    const header = webhookSignatureHeader(secret, 1_700_000_000, body);
    expect(verifyWebhookSignature(secret, header, body, { nowSeconds: 1_700_000_000 })).toBe(true);
    expect(verifyWebhookSignature("fs_whsec_other", header, body, { nowSeconds: 1_700_000_000 })).toBe(false);
  });
});

describe("webhook payload contract", () => {
  test("includes only public form and submission fields", () => {
    const payload = buildWebhookPayload({
      deliveryId: "delivery-1",
      event: submissionCreatedEvent,
      createdAt: "2026-09-25T12:00:00.000Z",
      form: { id: "form-1", slug: "contact", title: "Contact", version: 3 },
      submission: {
        id: "sub-1",
        createdAt: "2026-09-25T12:00:00.000Z",
        data: { name: "Ada", email: "ada@example.com" },
      },
    });

    expect(payload).toEqual({
      id: "delivery-1",
      event: "submission.created",
      createdAt: "2026-09-25T12:00:00.000Z",
      form: { id: "form-1", slug: "contact", title: "Contact", version: 3 },
      submission: {
        id: "sub-1",
        createdAt: "2026-09-25T12:00:00.000Z",
        data: { name: "Ada", email: "ada@example.com" },
      },
    });
    expect(JSON.stringify(payload)).not.toContain("notifyEmail");
    expect(JSON.stringify(payload)).not.toContain("registryKey");
    expect(JSON.stringify(payload)).not.toContain("actorHash");
  });

  test("sample data uses field types without real submissions", () => {
    const data = sampleSubmissionData({
      schemaVersion: 1,
      title: "Contact",
      submitLabel: "Send",
      successMessage: "Thanks",
      steps: [
        {
          id: "step_1",
          title: "Details",
          fields: [
            { id: "name", type: "text", label: "Name", required: true },
            { id: "email", type: "email", label: "Email", required: true },
          ],
        },
      ],
    });
    expect(data).toEqual({
      name: "Example response",
      email: "person@example.com",
    });
  });
});

describe("SSRF webhook URL validation", () => {
  const deny = { allowLoopback: false };

  test("requires https without credentials", async () => {
    await expect(assertSafeWebhookUrl("http://example.com/hook", deny, async () => ["93.184.216.34"])).rejects.toThrow(
      WebhookUrlError,
    );
    await expect(
      assertSafeWebhookUrl("https://user:pass@example.com/hook", deny, async () => ["93.184.216.34"]),
    ).rejects.toThrow(/credentials/);
  });

  test("rejects localhost and loopback literals", async () => {
    await expect(assertSafeWebhookUrl("https://localhost/hook", deny)).rejects.toThrow(/localhost/);
    await expect(assertSafeWebhookUrl("https://127.0.0.1/hook", deny)).rejects.toThrow(/private or local/);
    await expect(assertSafeWebhookUrl("https://[::1]/hook", deny)).rejects.toThrow(/private or local/);
  });

  test("rejects private and metadata addresses", () => {
    expect(isDisallowedIpv4("10.0.0.8")).toBe(true);
    expect(isDisallowedIpv4("172.16.4.1")).toBe(true);
    expect(isDisallowedIpv4("192.168.1.20")).toBe(true);
    expect(isDisallowedIpv4("169.254.169.254")).toBe(true);
    expect(isDisallowedIpv4("100.64.1.2")).toBe(true);
    expect(isDisallowedIpv4("8.8.8.8")).toBe(false);
    expect(isDisallowedIpv6("fc00::1")).toBe(true);
    expect(isDisallowedIpv6("fe80::1")).toBe(true);
    expect(isDisallowedIpv6("::ffff:127.0.0.1")).toBe(true);
  });

  test("rejects hostnames that resolve to any private address", async () => {
    await expect(
      assertSafeWebhookUrl("https://hook.example/path", deny, async () => ["8.8.8.8", "10.0.0.1"]),
    ).rejects.toThrow(/private or local/);
  });

  test("allows public https hosts", async () => {
    const url = await assertSafeWebhookUrl("https://hooks.example.com/forms", deny, async () => ["93.184.216.34"]);
    expect(url.href).toBe("https://hooks.example.com/forms");
  });

  test("scoped loopback helper allows local URLs outside production", async () => {
    const url = await assertSafeWebhookUrl("http://127.0.0.1:4010/hook", { allowLoopback: true });
    expect(url.href).toBe("http://127.0.0.1:4010/hook");
  });
});

describe("webhook ownership helper", () => {
  test("rejects cross-form webhook access", () => {
    expect(() => assertWebhookOwnedByForm("form-a", "form-b")).toThrow("Webhook not found");
    expect(() => assertWebhookOwnedByForm("form-a", "form-a")).not.toThrow();
  });
});
