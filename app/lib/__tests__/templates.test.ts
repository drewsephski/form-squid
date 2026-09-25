import { describe, expect, test } from "@jest/globals";
import { compileForm } from "../compiler";
import { formSpecSchema } from "../definitions";
import { resolveAppearance } from "../appearance";
import { templates } from "../templates";

describe("templates", () => {
  test("every curated template is a valid form spec", () => {
    expect(templates.length).toBeGreaterThanOrEqual(6);
    for (const template of templates) {
      expect(formSpecSchema.parse(template.spec).title).toBe(template.spec.title);
      expect(template.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });

  test("exported source uses the draft appearance and the slug it was given", () => {
    const template = templates[0];
    if (!template) {
      throw new Error("Missing template");
    }
    const compiled = compileForm(template.spec, {
      submission: "formsquid",
      url: "https://formsquid.com/api/submit/new-address",
    });
    const appearance = resolveAppearance(template.spec);
    expect(compiled.formSource).toContain("https://formsquid.com/api/submit/new-address");
    expect(compiled.formSource).toContain(appearance.theme);
    expect(compiled.formSource).toContain(appearance.accent === "violet" ? "oklch(0.702 0.183 293.541)" : "max-w-");
  });

  test("callback export calls onSubmit and does not embed a FormSquid URL", () => {
    const template = templates[0];
    if (!template) {
      throw new Error("Missing template");
    }
    const compiled = compileForm(template.spec, { submission: "callback" });
    expect(compiled.formSource).toContain("onSubmit");
    expect(compiled.formSource).toContain("await onSubmit(");
    expect(compiled.formSource).not.toContain("submitUrl");
    expect(compiled.formSource).not.toContain("fetch(");
    expect(compiled.schemaSource).toContain("submissionSchema");
  });
});
