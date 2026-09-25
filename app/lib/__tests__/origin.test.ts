import { afterEach, describe, expect, test } from "@jest/globals";
import { submitUrlFor, uploadUrlFor } from "../origin";

const originalNodeEnv = process.env.NODE_ENV;
const originalOrigin = process.env.FORM_API_ORIGIN;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalOrigin === undefined) {
    delete process.env.FORM_API_ORIGIN;
  } else {
    process.env.FORM_API_ORIGIN = originalOrigin;
  }
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
