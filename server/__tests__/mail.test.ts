import { afterEach, describe, expect, test } from "@jest/globals";
import { senderAddress } from "../mail";

const originalNodeEnv = process.env.NODE_ENV;
const originalVercelEnv = process.env.VERCEL_ENV;
const originalFrom = process.env.RESEND_FROM;
const originalAuthFrom = process.env.RESEND_AUTH_FROM;

function restore(name: "VERCEL_ENV" | "RESEND_FROM" | "RESEND_AUTH_FROM", value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  restore("VERCEL_ENV", originalVercelEnv);
  restore("RESEND_FROM", originalFrom);
  restore("RESEND_AUTH_FROM", originalAuthFrom);
});

describe("senderAddress", () => {
  test("uses the configured submission sender", () => {
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL_ENV;
    process.env.RESEND_FROM = "FormSquid <forms@formsquid.com>";
    expect(senderAddress("RESEND_FROM")).toBe("FormSquid <forms@formsquid.com>");
  });

  test("lets local auth mail fall back to RESEND_FROM", () => {
    process.env.NODE_ENV = "development";
    delete process.env.VERCEL_ENV;
    delete process.env.RESEND_AUTH_FROM;
    process.env.RESEND_FROM = "FormSquid <forms@formsquid.com>";
    expect(senderAddress("RESEND_AUTH_FROM")).toBe("FormSquid <forms@formsquid.com>");
  });

  test("fails when production is missing a sender", () => {
    process.env.NODE_ENV = "production";
    delete process.env.RESEND_FROM;
    expect(() => senderAddress("RESEND_FROM")).toThrow("RESEND_FROM is required in production.");
  });

  test("fails when production still uses the Resend test sender", () => {
    process.env.NODE_ENV = "production";
    process.env.RESEND_FROM = "FormSquid <onboarding@resend.dev>";
    expect(() => senderAddress("RESEND_FROM")).toThrow("cannot use the Resend test sender");
  });
});
