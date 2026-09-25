import { describe, expect, test } from "@jest/globals";
import { bucketStart, hashClientAddress } from "../rate-limit";
import { submissionLog } from "../submission-log";

describe("submission rate limit", () => {
  test("truncates the bucket to the UTC minute", () => {
    expect(bucketStart(new Date("2026-09-24T12:00:30.250Z")).toISOString()).toBe("2026-09-24T12:00:00.000Z");
  });

  test("stores a salted hash and not the address", () => {
    const hash = hashClientAddress("203.0.113.8", "salt");
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("203.0.113.8");
    expect(hashClientAddress("203.0.113.8", "other")).not.toBe(hash);
  });

  test("logs status without submission contents", () => {
    const line = submissionLog({
      event: "submission.invalid",
      requestId: "req-1",
      formId: "form-1",
      durationMs: 12,
      status: 400,
      reason: "validation",
    });
    expect(JSON.parse(line)).toEqual({
      event: "submission.invalid",
      requestId: "req-1",
      formId: "form-1",
      durationMs: 12,
      status: 400,
      reason: "validation",
    });
  });
});