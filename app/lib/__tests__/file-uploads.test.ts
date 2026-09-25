import { describe, expect, test } from "@jest/globals";
import { compileForm } from "../compiler";
import { formSpecSchema } from "../definitions";
import { mimeAllowed, sanitizeDisplayFilename } from "../file-field";
import { labeledAnswers, csvFileCell } from "../submission-display";
import { validateSubmission } from "../validate-submission";
import { sampleFileRef } from "../sample-file-ref";
import { buildWebhookPayload, sampleSubmissionData, submissionCreatedEvent } from "../../../server/webhooks/payload";

const resume = formSpecSchema.parse({
  schemaVersion: 1,
  title: "Apply",
  submitLabel: "Send",
  successMessage: "Sent",
  steps: [
    {
      id: "main",
      title: "Details",
      fields: [
        { id: "name", type: "text", label: "Name", required: true },
        {
          id: "resume",
          type: "file",
          label: "Resume",
          required: true,
          maxFiles: 1,
          maxFileSizeMb: 10,
          accept: ["application/pdf"],
        },
        {
          id: "need_attachments",
          type: "checkbox",
          label: "Add attachments",
          required: false,
        },
        {
          id: "attachments",
          type: "file",
          label: "Attachments",
          required: true,
          maxFiles: 5,
          visibleWhen: { fieldId: "need_attachments", equals: "true" },
        },
      ],
    },
  ],
});

describe("file field FormSpec", () => {
  test("parses file fields on schema version 1", () => {
    expect(resume.steps[0]?.fields.some((field) => field.type === "file")).toBe(true);
  });

  test("keeps existing v1 specs valid without file fields", () => {
    const contact = formSpecSchema.parse({
      schemaVersion: 1,
      title: "Contact",
      submitLabel: "Send",
      successMessage: "Thanks",
      steps: [{ id: "main", title: "Main", fields: [{ id: "email", type: "email", label: "Email", required: true }] }],
    });
    expect(contact.title).toBe("Contact");
  });
});

describe("file submission validation", () => {
  test("requires visible file fields", () => {
    const result = validateSubmission(resume, { name: "Drew" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.path === "resume")).toBe(true);
    }
  });

  test("accepts upload ids for required files", () => {
    const uploadId = "11111111-1111-4111-8111-111111111111";
    const result = validateSubmission(resume, { name: "Drew", resume: uploadId });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.resume).toBe(uploadId);
      expect(result.data.name).toBe("Drew");
    }
  });

  test("ignores hidden required file fields", () => {
    const uploadId = "11111111-1111-4111-8111-111111111111";
    const result = validateSubmission(resume, {
      name: "Drew",
      resume: uploadId,
      need_attachments: false,
      attachments: "22222222-2222-4222-8222-222222222222",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.attachments).toBeUndefined();
    }
  });

  test("rejects oversized browser files", () => {
    const result = validateSubmission(resume, {
      name: "Drew",
      resume: { name: "huge.pdf", size: 20 * 1024 * 1024, type: "application/pdf" },
    });
    expect(result.ok).toBe(false);
  });

  test("rejects invalid mime types", () => {
    expect(mimeAllowed("application/x-msdownload", ["application/pdf"])).toBe(false);
    const result = validateSubmission(resume, {
      name: "Drew",
      resume: { name: "evil.exe", size: 100, type: "application/x-msdownload" },
    });
    expect(result.ok).toBe(false);
  });
});

describe("file display and webhooks", () => {
  test("labels filenames without urls", () => {
    const answers = labeledAnswers(resume, {
      name: "Drew",
      resume: { id: "11111111-1111-4111-8111-111111111111", name: "drew.pdf", contentType: "application/pdf", size: 284231 },
    });
    const resumeAnswer = answers.find((answer) => answer.id === "resume");
    expect(resumeAnswer?.value).toContain("drew.pdf");
    expect(resumeAnswer?.value).not.toContain("http");
  });

  test("csv uses stable ids not signed urls", () => {
    const cell = csvFileCell({
      id: "11111111-1111-4111-8111-111111111111",
      name: "drew.pdf",
      contentType: "application/pdf",
      size: 10,
    });
    expect(cell).toBe("drew.pdf (11111111-1111-4111-8111-111111111111)");
    expect(cell).not.toContain("https://");
  });

  test("webhook sample data uses file metadata", () => {
    const data = sampleSubmissionData(resume);
    expect(data.resume).toEqual(sampleFileRef(resume.steps[0]!.fields[1]!));
    const payload = buildWebhookPayload({
      deliveryId: "delivery",
      event: submissionCreatedEvent,
      createdAt: "2026-09-25T00:00:00.000Z",
      form: { id: "form", slug: "apply", title: "Apply", version: 1 },
      submission: { id: "sub", createdAt: "2026-09-25T00:00:00.000Z", data },
    });
    expect(JSON.stringify(payload)).not.toContain("storage");
    expect(JSON.stringify(payload)).not.toContain("signed");
  });

  test("sanitizes display filenames", () => {
    expect(sanitizeDisplayFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeDisplayFilename('bad<>:"|?.pdf')).toBe("bad______.pdf");
  });
});

describe("default file accept policy", () => {
  test("does not include unverified Office formats in the default allowlist", async () => {
    const { defaultAcceptMimeTypes } = await import("../upload-limits");
    expect(defaultAcceptMimeTypes).not.toContain("application/msword");
    expect(defaultAcceptMimeTypes).not.toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(defaultAcceptMimeTypes).toContain("application/pdf");
  });
});

describe("exported file field sources", () => {
  test("callback source keeps browser File objects and does not call the upload API", () => {
    const compiled = compileForm(resume, { submission: "callback" });
    expect(compiled.formSource).toContain("browser File objects");
    expect(compiled.formSource).not.toContain("/uploads");
    expect(compiled.formSource).not.toContain("uploadId");
  });

  test("hosted registry source uses the upload API and opaque upload ids", () => {
    const compiled = compileForm(resume, {
      submission: "formsquid",
      url: "https://api.formsquid.com/forms/apply/submissions",
      uploadUrl: "https://api.formsquid.com/forms/apply/uploads",
    });
    expect(compiled.formSource).toContain("https://api.formsquid.com/forms/apply/uploads");
    expect(compiled.formSource).toContain("uploadId");
    expect(compiled.formSource).toContain("serializeSubmission");
  });
});
