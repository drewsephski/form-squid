import { describe, expect, test } from "@jest/globals";
import { maxSubmissionBytes } from "../../app/lib/definitions";
import { submitForm, type SubmitDatabase } from "../submit-form";

const database = {
  select() {
    return {
      from() {
        return {
          where: async () => [],
        };
      },
    };
  },
} as unknown as SubmitDatabase;

describe("submitForm", () => {
  test("rejects null JSON", async () => {
    const result = await submitForm(database, { slug: "contact", rawBody: "null" });
    expect(result).toEqual({ status: 400, body: { ok: false, error: "Expected a JSON object." } });
  });

  test("rejects array JSON", async () => {
    const result = await submitForm(database, { slug: "contact", rawBody: "[]" });
    expect(result).toEqual({ status: 400, body: { ok: false, error: "Expected a JSON object." } });
  });

  test("rejects string JSON", async () => {
    const result = await submitForm(database, { slug: "contact", rawBody: '"hello"' });
    expect(result).toEqual({ status: 400, body: { ok: false, error: "Expected a JSON object." } });
  });

  test("rejects malformed JSON", async () => {
    const result = await submitForm(database, { slug: "contact", rawBody: "{" });
    expect(result).toEqual({ status: 400, body: { ok: false, error: "Expected JSON." } });
  });

  test("rejects payloads over the UTF-8 byte limit", async () => {
    const unit = "é";
    const rawBody = unit.repeat(Math.floor(maxSubmissionBytes / 2) + 1);
    expect(rawBody.length).toBeLessThanOrEqual(maxSubmissionBytes);
    expect(Buffer.byteLength(rawBody, "utf8")).toBeGreaterThan(maxSubmissionBytes);

    const result = await submitForm(database, { slug: "contact", rawBody });
    expect(result).toEqual({ status: 413, body: { ok: false, error: "Submission is too large." } });
  });
});
