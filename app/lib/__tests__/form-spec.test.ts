import { describe, expect, test } from "@jest/globals";
import ts from "typescript";
import { compileForm } from "../compiler";
import { formHostSlug } from "../form-host";
import { parseNumberInput } from "../number-input";
import { reservedSlugs } from "../reserved-slugs";
import { formSpecSchema, type FormSpec } from "../definitions";
import { normalizeFormSpec } from "../normalize-form-spec";
import { validateSubmission } from "../validate-submission";

const submitUrl = "https://formsquid.com/api/submit/contact";

function spec(input: unknown): FormSpec {
  return formSpecSchema.parse(input);
}

const contact = spec({
  schemaVersion: 1,
  title: "Contact",
  description: "Say hello",
  submitLabel: "Send",
  successMessage: "Thanks",
  steps: [
    {
      id: "main",
      title: "Details",
      fields: [
        { id: "name", type: "text", label: "Name", required: true },
        { id: "email", type: "email", label: "Email", required: true },
      ],
    },
  ],
});

const allTypes = spec({
  schemaVersion: 1,
  title: "All types",
  submitLabel: "Send",
  successMessage: "Saved",
  steps: [
    {
      id: "main",
      title: "Fields",
      fields: [
        { id: "name", type: "text", label: "Name", required: true },
        { id: "email", type: "email", label: "Email", required: false },
        { id: "notes", type: "textarea", label: "Notes", required: false },
        { id: "budget", type: "number", label: "Budget", required: true },
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
        {
          id: "contact",
          type: "radio",
          label: "Contact",
          required: true,
          options: [
            { value: "email", label: "Email" },
            { value: "phone", label: "Phone" },
          ],
        },
        { id: "agree", type: "checkbox", label: "Agree", required: true },
        { id: "start", type: "date", label: "Start", required: true },
      ],
    },
  ],
});

const multiStep = spec({
  schemaVersion: 1,
  title: "Project",
  submitLabel: "Send",
  successMessage: "Sent",
  steps: [
    {
      id: "about",
      title: "About",
      fields: [{ id: "name", type: "text", label: "Name", required: true }],
    },
    {
      id: "work",
      title: "Work",
      fields: [{ id: "goal", type: "textarea", label: "Goal", required: true }],
    },
  ],
});

const conditional = spec({
  schemaVersion: 1,
  title: "Business",
  submitLabel: "Send",
  successMessage: "Sent",
  steps: [
    {
      id: "main",
      title: "Business",
      fields: [
        {
          id: "owns",
          type: "radio",
          label: "Do you own a business?",
          required: true,
          options: [
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ],
        },
        {
          id: "business_name",
          type: "text",
          label: "Business name",
          required: true,
          visibleWhen: { fieldId: "owns", equals: "yes" },
        },
      ],
    },
  ],
});

const hostile = spec({
  schemaVersion: 1,
  title: 'Say "hello" `now`',
  description: "line one\nline two ${process.env}",
  submitLabel: "Send'); alert('x",
  successMessage: "Done\n`ok`",
  steps: [
    {
      id: "main",
      title: "Step `one`",
      fields: [
        {
          id: "note",
          type: "text",
          label: '"); alert("xss',
          description: "back`tick\nnewline",
          placeholder: "${constructor}",
          required: true,
        },
      ],
    },
  ],
});

function loadSchema(source: string) {
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
      safeParse: (input: unknown) => {
        success: boolean;
        data?: Record<string, unknown>;
      };
    };
  };
}

function expectParity(form: FormSpec, payload: unknown) {
  const runtime = validateSubmission(form, payload);
  const parsed = loadSchema(compileForm(form, { submission: "formsquid", url: submitUrl, uploadUrl: "https://formsquid.com/api/upload/contact" }).schemaSource).submissionSchema.safeParse(payload);
  expect(parsed.success).toBe(runtime.ok);
  if (runtime.ok && parsed.success) {
    expect(parsed.data).toEqual(runtime.data);
  }
}

describe("form spec", () => {
  test("rejects duplicate ids", () => {
    expect(() =>
      spec({
        schemaVersion: 1,
        title: "Dup",
        submitLabel: "Send",
        successMessage: "Ok",
        steps: [
          {
            id: "main",
            title: "Main",
            fields: [
              { id: "email", type: "email", label: "Email", required: true },
              { id: "email", type: "text", label: "Again", required: true },
            ],
          },
        ],
      }),
    ).toThrow();
  });

  test("rejects a condition that points at a missing or later field", () => {
    expect(() =>
      spec({
        schemaVersion: 1,
        title: "Bad",
        submitLabel: "Send",
        successMessage: "Ok",
        steps: [
          {
            id: "main",
            title: "Main",
            fields: [
              {
                id: "name",
                type: "text",
                label: "Name",
                required: true,
                visibleWhen: { fieldId: "later", equals: "x" },
              },
              { id: "later", type: "text", label: "Later", required: false },
            ],
          },
        ],
      }),
    ).toThrow(/earlier field/);
  });

  test("allows comparison punctuation in labels", () => {
    const form = spec({
      schemaVersion: 1,
      title: "Budget < $5,000",
      submitLabel: "Send",
      successMessage: "Ok",
      steps: [
        {
          id: "main",
          title: "Employees > 50",
          fields: [{ id: "name", type: "text", label: "Budget < $5,000", required: true }],
        },
      ],
    });
    expect(form.title).toBe("Budget < $5,000");
  });

  test("normalizes nullable AI output into the canonical spec", () => {
    const normalized = normalizeFormSpec({
      schemaVersion: 1,
      title: "Contact",
      description: null,
      submitLabel: "Send",
      successMessage: "Thanks",
      steps: [
        {
          id: "main",
          title: "Details",
          fields: [
            {
              id: "email",
              type: "email",
              label: "Email",
              description: null,
              placeholder: "you@work.com",
              required: true,
              options: null,
              visibleWhen: null,
            },
          ],
        },
      ],
    });

    expect(normalized.description).toBeUndefined();
    expect(normalized.steps[0]?.fields[0]?.placeholder).toBe("you@work.com");
    expect(normalized.steps[0]?.fields[0]?.visibleWhen).toBeUndefined();
  });
});

describe("validateSubmission", () => {
  test("accepts a simple contact form", () => {
    const result = validateSubmission(contact, { name: "Ada", email: "ada@work.com" });
    expect(result).toEqual({ ok: true, data: { name: "Ada", email: "ada@work.com" } });
  });

  test("accepts every field type", () => {
    const payload = {
      name: "Ada",
      email: "ada@work.com",
      notes: "Hello",
      budget: 1200,
      plan: "pro",
      contact: "email",
      agree: true,
      start: "2026-09-24",
    };
    expect(validateSubmission(allTypes, payload)).toEqual({ ok: true, data: payload });
  });

  test("validates the current step and the whole form separately", () => {
    expect(validateSubmission(multiStep, { name: "Ada" }, { stepId: "about" }).ok).toBe(true);
    expect(validateSubmission(multiStep, { name: "Ada" }).ok).toBe(false);
    expect(validateSubmission(multiStep, { name: "Ada", goal: "Ship" }).ok).toBe(true);
  });

  test("requires a visible conditional field", () => {
    const result = validateSubmission(conditional, { owns: "yes" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((error) => error.path === "business_name")).toBe(true);
    }
  });

  test("omits a hidden required field", () => {
    const result = validateSubmission(conditional, { owns: "no", business_name: "Acme" });
    expect(result).toEqual({ ok: true, data: { owns: "no" } });
  });

  test("treats a cleared optional number as absent", () => {
    const form = spec({
      schemaVersion: 1,
      title: "Budget",
      submitLabel: "Send",
      successMessage: "Ok",
      steps: [
        {
          id: "main",
          title: "Main",
          fields: [{ id: "budget", type: "number", label: "Budget", required: false }],
        },
      ],
    });
    expect(parseNumberInput("")).toBeUndefined();
    expect(parseNumberInput("123")).toBe(123);
    expect(validateSubmission(form, {}).ok).toBe(true);
    expect(validateSubmission(form, { budget: Number.NaN }).ok).toBe(false);
  });

  test("rejects unknown keys", () => {
    expect(validateSubmission(contact, { name: "Ada", email: "ada@work.com", extra: "no" }).ok).toBe(false);
  });
});

describe("form hosts", () => {
  test("serves a form slug and blocks reserved or nested hosts", () => {
    expect(formHostSlug("client.formsquid.com", "formsquid.com")).toBe("client");
    expect(formHostSlug("api.formsquid.com", "formsquid.com")).toBeNull();
    expect(formHostSlug("formsquid.com", "formsquid.com")).toBeNull();
    expect(formHostSlug("a.b.formsquid.com", "formsquid.com")).toBeNull();
    expect(reservedSlugs.has("api")).toBe(true);
  });
});

describe("compiler", () => {
  test("parses generated source", () => {
    const compiled = compileForm(hostile, { submission: "formsquid", url: submitUrl, uploadUrl: "https://formsquid.com/api/upload/contact" });
    for (const [fileName, source] of [
      ["schema.ts", compiled.schemaSource],
      ["form.tsx", compiled.formSource],
    ] as const) {
      const transpiled = ts.transpileModule(source, {
        compilerOptions: {
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
        },
        fileName,
        reportDiagnostics: true,
      });
      const errors = (transpiled.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
      expect(errors).toEqual([]);
    }
  });

  test("keeps hostile strings inside the generated source", () => {
    const compiled = compileForm(hostile, { submission: "formsquid", url: submitUrl, uploadUrl: "https://formsquid.com/api/upload/contact" });
    expect(compiled.formSource).toContain(JSON.stringify('"); alert("xss'));
    expect(compiled.formSource).toContain(JSON.stringify("back`tick\nnewline"));
    expect(compiled.schemaSource).toContain(JSON.stringify('"); alert("xss'));
  });

  test("subscribes exported conditions with useWatch and clears empty numbers", () => {
    const source = compileForm(conditional, { submission: "formsquid", url: submitUrl, uploadUrl: "https://formsquid.com/api/upload/contact" }).formSource;
    expect(source).toContain("useWatch");
    expect(source).toContain("conditionMet(spec, watched ?? {}, field)");
    expect(source).not.toContain("conditionMet(spec, form.getValues()");
    expect(source).toContain("parseNumberInput");
    expect(source).not.toContain("valueAsNumber");
  });

  test("renders date fields with the shadcn calendar popover", () => {
    const compiled = compileForm(allTypes, { submission: "formsquid", url: submitUrl, uploadUrl: "https://formsquid.com/api/upload/contact" });
    expect(compiled.formSource).toContain("DateField");
    expect(compiled.formSource).toContain("Calendar");
    expect(compiled.formSource).toContain("Popover");
    expect(compiled.formSource).not.toContain('type="date"');
    expect(compiled.formSource).not.toContain("type={field.type === \"date\"");
    expect(compiled.registryDependencies).toEqual(
      expect.arrayContaining(["calendar", "popover"]),
    );
  });

  test("matches the runtime validator for the fixture payloads", () => {
    const cases: Array<[FormSpec, unknown]> = [
      [contact, { name: "Ada", email: "ada@work.com" }],
      [contact, { name: "", email: "ada@work.com" }],
      [contact, { name: "Ada", email: "not-an-email" }],
      [
        allTypes,
        {
          name: "Ada",
          email: "ada@work.com",
          notes: "Hello",
          budget: 1200,
          plan: "pro",
          contact: "email",
          agree: true,
          start: "2026-09-24",
        },
      ],
      [allTypes, { name: "Ada", budget: "1200", plan: "pro", contact: "email", agree: true, start: "2026-09-24" }],
      [multiStep, { name: "Ada", goal: "Ship" }],
      [multiStep, { name: "Ada" }],
      [conditional, { owns: "yes", business_name: "Acme" }],
      [conditional, { owns: "yes" }],
      [conditional, { owns: "no", business_name: "Acme" }],
      [hostile, { note: '"); alert("xss' }],
    ];

    for (const [form, payload] of cases) {
      expectParity(form, payload);
    }
  });
});
