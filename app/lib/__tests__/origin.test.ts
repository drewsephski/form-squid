import { afterEach, describe, expect, test } from "@jest/globals";
import { appOrigin, submitUrlFor, uploadUrlFor } from "../origin";

const originalNodeEnv = process.env.NODE_ENV;
const originalOrigin = process.env.FORM_API_ORIGIN;
const originalAppOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalOrigin === undefined) {
    delete process.env.FORM_API_ORIGIN;
  } else {
    process.env.FORM_API_ORIGIN = originalOrigin;
  }
  if (originalAppOrigin === undefined) {
    delete process.env.NEXT_PUBLIC_APP_ORIGIN;
  } else {
    process.env.NEXT_PUBLIC_APP_ORIGIN = originalAppOrigin;
  }
});

describe("appOrigin", () => {
  test("uses the configured origin and strips a trailing slash", () => {
    process.env.NEXT_PUBLIC_APP_ORIGIN = "https://formsquid.com/";
    expect(appOrigin()).toBe("https://formsquid.com");
  });

  test("falls back to production when unset in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_APP_ORIGIN;
    expect(appOrigin()).toBe("https://formsquid.com");
  });

  test("falls back to localhost outside production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.NEXT_PUBLIC_APP_ORIGIN;
    expect(appOrigin()).toBe("http://localhost:3000");
  });
});

describe("submitUrlFor", () => {
  test("requires an explicit origin outside production", () => {
    process.env.NODE_ENV = "development";
    delete process.env.FORM_API_ORIGIN;
    expect(() => submitUrlFor("contact")).toThrow("FORM_API_ORIGIN must be configured.");
  });

  test("uses the production API when the origin is unset", () => {
    process.env.NODE_ENV = "production";
    delete process.env.FORM_API_ORIGIN;
    expect(submitUrlFor("contact")).toBe("https://api.formsquid.com/forms/contact/submissions");
    expect(uploadUrlFor("contact")).toBe("https://api.formsquid.com/forms/contact/uploads");
  });

  test("uses a configured origin and strips a trailing slash", () => {
    process.env.NODE_ENV = "development";
    process.env.FORM_API_ORIGIN = "https://fn.example.test/";
    expect(submitUrlFor("contact")).toBe("https://fn.example.test/forms/contact/submissions");
    expect(uploadUrlFor("contact")).toBe("https://fn.example.test/forms/contact/uploads");
  });
});
