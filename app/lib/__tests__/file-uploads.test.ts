import { describe, expect, test } from "@jest/globals";
import ts from "typescript";
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

function loadGeneratedSchema(source: string) {
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: "schema.ts",
  });
  const compiledModule = { exports: {} as Record<string, unknown> };
  const run = new Function("exports", "require", "module", output.outputText);
  run(compiledModule.exports, require, compiledModule);
  return compiledModule.exports as {
    submissionSchema: {
      safeParse: (input: unknown) => { success: boolean; data?: Record<string, unknown> };
    };
    stepSchemas: Record<string, {
      safeParse: (input: unknown) => { success: boolean; data?: Record<string, unknown> };
    }>;
  };
}

function expectGeneratedSchemaParity(spec: ReturnType<typeof formSpecSchema.parse>, payload: unknown) {
  const runtime = validateSubmission(spec, payload);
  const generated = compileForm(spec, { submission: "callback" }).schemaSource;
  const parsed = loadGeneratedSchema(generated).submissionSchema.safeParse(payload);
  expect(parsed.success).toBe(runtime.ok);
  if (runtime.ok && parsed.success) {
    expect(parsed.data).toEqual(runtime.data);
  }
}

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

describe("generated schema file validation parity", () => {
  const uploadId = "11111111-1111-4111-8111-111111111111";

  test("accepts required hosted upload ids and matches normalized submission data", () => {
    expectGeneratedSchemaParity(resume, {
      name: "Drew",
      resume: uploadId,
      need_attachments: true,
      attachments: [uploadId, "22222222-2222-4222-8222-222222222222"],
    });
  });

  test("accepts an absent optional file and callback File-like values", () => {
    const optionalFile = formSpecSchema.parse({
      schemaVersion: 1,
      title: "Optional upload",
      submitLabel: "Send",
      successMessage: "Sent",
      steps: [{ id: "main", title: "Details", fields: [{ id: "attachment", type: "file", label: "Attachment", required: false }] }],
    });
    expectGeneratedSchemaParity(optionalFile, {});
    expectGeneratedSchemaParity(resume, {
      name: "Drew",
      resume: { name: "drew.pdf", size: 400, type: "application/pdf" },
      need_attachments: false,
    });
  });

  test("rejects missing required files and oversized callback files", () => {
    expectGeneratedSchemaParity(resume, { name: "Drew" });
    expectGeneratedSchemaParity(resume, {
      name: "Drew",
      resume: { name: "huge.pdf", size: 20 * 1024 * 1024, type: "application/pdf" },
      need_attachments: false,
    });
  });

  test("ignores required files hidden by a conditional and requires them when visible", () => {
    expectGeneratedSchemaParity(resume, {
      name: "Drew",
      resume: uploadId,
      need_attachments: false,
    });
    expectGeneratedSchemaParity(resume, {
      name: "Drew",
      resume: uploadId,
      need_attachments: true,
    });
  });

  test("normalizes uploaded widget metadata before step and submission validation", () => {
    const generated = loadGeneratedSchema(compileForm(resume, {
      submission: "formsquid",
      url: "https://api.formsquid.com/forms/apply/submissions",
      uploadUrl: "https://api.formsquid.com/forms/apply/uploads",
    }).schemaSource);
    const resumeWidgetValue = {
      uploadId,
      name: "drew.pdf",
      size: 1200,
      contentType: "application/pdf",
    };
    const attachmentWidgetValues = [
      { uploadId: "22222222-2222-4222-8222-222222222222", name: "one.pdf", size: 300, contentType: "application/pdf" },
      { uploadId: "33333333-3333-4333-8333-333333333333", name: "two.pdf", size: 400, contentType: "application/pdf" },
    ];
    const payload = {
      name: "Drew",
      resume: resumeWidgetValue,
      need_attachments: true,
      attachments: attachmentWidgetValues,
    };

    const stepResult = generated.stepSchemas.main?.safeParse(payload);
    const submissionResult = generated.submissionSchema.safeParse(payload);
    expect(stepResult?.success).toBe(true);
    expect(stepResult?.data?.resume).toBe(uploadId);
    expect(stepResult?.data?.attachments).toEqual(attachmentWidgetValues.map((file) => file.uploadId));
    expect(submissionResult.success).toBe(true);
    expect(submissionResult.data?.resume).toBe(uploadId);
    expect(submissionResult.data?.attachments).toEqual(attachmentWidgetValues.map((file) => file.uploadId));

    const hidden = generated.submissionSchema.safeParse({
      name: "Drew",
      resume: resumeWidgetValue,
      need_attachments: false,
      attachments: attachmentWidgetValues,
    });
    expect(hidden.success).toBe(true);
    expect(hidden.data?.attachments).toBeUndefined();
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
    expect(compiled.formSource).toContain('"Choose up to " + maxFiles + " files."');
    expect(compiled.formSource).not.toContain("slice(0, maxFiles)");
    expect(compiled.formSource).toContain("onUploadStateChange(field.id, { pending: false, error: true })");
    expect(compiled.formSource).toContain("Clear file selection");
    expect(compiled.formSource).toContain("if (disabled || !list || list.length === 0) return;");
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
    expect(compiled.formSource).toContain("pendingUploadCountRef.current > 0");
    expect(compiled.formSource).toContain("uploadIssueCountRef.current > 0");
    expect(compiled.formSource).toContain("if (sendingRef.current) return;");
    expect(compiled.formSource).toContain("disabled={sending || pendingUploadCount > 0}");
    expect(compiled.formSource).not.toContain("slice(0, maxFiles)");
    expect(compiled.formSource).toContain("Clear file selection");
    expect(compiled.formSource).toContain("if (disabled || pending || !list || list.length === 0) return;");
  });
});
