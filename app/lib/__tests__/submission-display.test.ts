import { describe, expect, test } from "@jest/globals";
import type { FormSpec } from "../definitions";
import { labeledAnswers, submissionIdentity, submissionSearchText } from "../submission-display";

const spec: FormSpec = {
  schemaVersion: 1,
  title: "Intake",
  submitLabel: "Send",
  successMessage: "Thanks",
  steps: [
    {
      id: "about",
      title: "About",
      fields: [
        { id: "name", type: "text", label: "Name", required: true },
        { id: "email", type: "email", label: "Email", required: true },
        {
          id: "plan",
          type: "select",
          label: "Plan",
          required: true,
          options: [
            { value: "basic", label: "Basic" },
            { value: "pro", label: "Pro" },
          ],
        },
      ],
    },
  ],
};

describe("submission display", () => {
  test("labels answers from the version spec", () => {
    expect(labeledAnswers(spec, { name: "Ada Smoke", email: "ada@example.com", plan: "pro" })).toEqual([
      { id: "name", label: "Name", value: "Ada Smoke" },
      { id: "email", label: "Email", value: "ada@example.com" },
      { id: "plan", label: "Plan", value: "Pro" },
    ]);
  });

  test("picks a name and email for the list", () => {
    expect(submissionIdentity(spec, { name: "Ada Smoke", email: "ada@example.com", plan: "pro" })).toEqual({
      title: "Ada Smoke",
      detail: "ada@example.com",
    });
  });

  test("searches labeled values", () => {
    const text = submissionSearchText(spec, { name: "Ada", email: "ada@example.com", plan: "basic" });
    expect(text).toContain("basic");
    expect(text).toContain("ada@example.com");
    expect(text.includes("ada smoke")).toBe(false);
  });
});
