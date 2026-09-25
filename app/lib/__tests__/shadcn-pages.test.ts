import { describe, expect, test } from "@jest/globals";
import { compileForm } from "../compiler";
import { formSpecSchema } from "../definitions";
import { conditionalExample, multiStepExample } from "../shadcn/examples";
import { getShadcnPage, shadcnPages } from "../shadcn/pages";
import { templates } from "../templates";
import { templateSeo } from "../templates/seo";
import sitemap from "../../sitemap";

describe("shadcn pages", () => {
  test("publishes the planned example set with compilable callback source", () => {
    expect(shadcnPages.map((page) => page.slug)).toEqual([
      "form-builder",
      "client-intake-form",
      "job-application-form",
      "waitlist-form",
      "contact-form",
      "feedback-form",
      "multi-step-form",
      "conditional-form",
    ]);
    for (const page of shadcnPages) {
      expect(formSpecSchema.parse(page.spec).title).toBe(page.spec.title);
      const compiled = compileForm(page.spec, { submission: "callback" });
      expect(compiled.formSource).toContain("onSubmit");
      expect(compiled.formSource).not.toContain("fetch(");
      expect(compiled.formSource).not.toContain("submitUrl");
      for (const link of page.related) {
        expect(link.href.startsWith("/")).toBe(true);
      }
    }
    expect(getShadcnPage("conditional-form")?.spec).toBe(conditionalExample);
    expect(getShadcnPage("multi-step-form")?.spec).toBe(multiStepExample);
  });

  test("gives every template a search title and a shadcn link", () => {
    for (const template of templates) {
      const seo = templateSeo[template.slug];
      expect(seo?.title).toContain("Form Template | FormSquid");
      expect(seo?.description.length).toBeGreaterThan(40);
      expect(seo?.reactHref.startsWith("/shadcn/") || seo?.reactHref === "/shadcn/form-builder").toBe(true);
    }
  });

  test("lists only public marketing urls", () => {
    const paths = sitemap().map((entry) => new URL(entry.url).pathname);
    expect(paths).toContain("/");
    expect(paths).toContain("/templates/client-intake");
    expect(paths).toContain("/shadcn/form-builder");
    expect(paths.some((path) => path.startsWith("/f/") || path.startsWith("/forms"))).toBe(false);
  });
});
