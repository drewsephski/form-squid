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

function publishedDatabase(attempts: number) {
  return {
    select() {
      return {
        from() {
          return {
            where: async () => [{ id: "form-1", currentPublishedVersionId: "version-1" }],
          };
        },
      };
    },
    insert() {
      return {
        values() {
          return {
            onConflictDoUpdate() {
              return {
                returning: async () => [{ attempts }],
              };
            },
          };
        },
      };
    },
  } as unknown as SubmitDatabase;
}

describe("submitForm", () => {
  test("rejects null JSON once a published form exists", async () => {
    const result = await submitForm(publishedDatabase(1), { slug: "contact", rawBody: "null", actorHash: "actor" });
    expect(result.status).toBe(400);
    expect(result.body).toEqual({ ok: false, error: "Expected a JSON object." });
    expect(result.event).toBe("submission.invalid");
    expect(result.formId).toBe("form-1");
  });

  test("rejects array JSON once a published form exists", async () => {
    const result = await submitForm(publishedDatabase(1), { slug: "contact", rawBody: "[]", actorHash: "actor" });
    expect(result.body).toEqual({ ok: false, error: "Expected a JSON object." });
  });

  test("rejects string JSON once a published form exists", async () => {
    const result = await submitForm(publishedDatabase(1), { slug: "contact", rawBody: '"hello"', actorHash: "actor" });
    expect(result.body).toEqual({ ok: false, error: "Expected a JSON object." });
  });

  test("rejects malformed JSON once a published form exists", async () => {
    const result = await submitForm(publishedDatabase(1), { slug: "contact", rawBody: "{", actorHash: "actor" });
    expect(result.body).toEqual({ ok: false, error: "Expected JSON." });
    expect(result.reason).toBe("expected_json");
  });

  test("returns not found without reading a missing form", async () => {
    const result = await submitForm(database, { slug: "contact", rawBody: "null", actorHash: "actor" });
    expect(result).toMatchObject({
      status: 404,
      event: "submission.not_found",
      formId: null,
      reason: "missing_form",
    });
  });

  test("rejects the 21st attempt in the same minute", async () => {
    const result = await submitForm(publishedDatabase(21), {
      slug: "contact",
      rawBody: "{}",
      actorHash: "actor",
      now: new Date("2026-09-24T12:00:30.000Z"),
    });
    expect(result.status).toBe(429);
    expect(result.event).toBe("submission.rate_limited");
    expect(result.reason).toBe("attempt_window");
    expect(result.retryAfter).toBe(30);
    expect(result.body).toEqual({ ok: false, error: "Too many attempts. Try again in a minute." });
  });

  test("rejects payloads over the UTF-8 byte limit", async () => {
    const unit = "é";
    const rawBody = unit.repeat(Math.floor(maxSubmissionBytes / 2) + 1);
    expect(rawBody.length).toBeLessThanOrEqual(maxSubmissionBytes);
    expect(Buffer.byteLength(rawBody, "utf8")).toBeGreaterThan(maxSubmissionBytes);

    const result = await submitForm(database, { slug: "contact", rawBody, actorHash: "actor" });
    expect(result).toMatchObject({ status: 413, body: { ok: false, error: "Submission is too large." }, event: "submission.invalid" });
  });
});
