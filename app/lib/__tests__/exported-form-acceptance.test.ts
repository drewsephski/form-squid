import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "@jest/globals";
import ts from "typescript";
import { compileForm } from "../compiler";
import { formSpecSchema } from "../definitions";

const conditional = formSpecSchema.parse({
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

describe("exported form acceptance", () => {
  test("installs registry files that typecheck", () => {
    const submitUrl = "https://formsquid.com/api/submit/business";
    const compiled = compileForm(conditional, submitUrl);
    const registry = {
      $schema: "https://ui.shadcn.com/schema/registry-item.json",
      name: "business",
      type: "registry:block",
      files: [
        { path: "schema.ts", content: compiled.schemaSource },
        { path: "form.tsx", content: compiled.formSource },
      ],
    };
    const scratch = path.join(process.cwd(), ".tmp");
    mkdirSync(scratch, { recursive: true });
    const root = mkdtempSync(path.join(scratch, "formsquid-export-"));
    const installDir = path.join(root, "components", "business");
    mkdirSync(installDir, { recursive: true });
    for (const file of registry.files) {
      writeFileSync(path.join(installDir, file.path), file.content);
    }

    const program = ts.createProgram({
      rootNames: registry.files.map((file) => path.join(installDir, file.path)),
      options: {
        strict: true,
        jsx: ts.JsxEmit.ReactJSX,
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        target: ts.ScriptTarget.ES2022,
        baseUrl: process.cwd(),
        paths: { "@/*": ["./*"] },
        esModuleInterop: true,
        skipLibCheck: true,
        noEmit: true,
      },
    });
    const diagnostics = ts.getPreEmitDiagnostics(program).filter((item) => {
      const fileName = item.file?.fileName ?? "";
      return fileName.startsWith(installDir) && item.category === ts.DiagnosticCategory.Error;
    });
    const messages = diagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, "\n"));
    expect(messages).toEqual([]);
    expect(compiled.formSource).toContain(submitUrl);
    expect(compiled.formSource).toContain("useWatch");
  });
});
