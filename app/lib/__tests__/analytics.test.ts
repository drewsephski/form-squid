import { describe, expect, test } from "@jest/globals";
import { funnelEvents, funnelProperties } from "../analytics";

describe("funnel analytics", () => {
  test("keeps only the allowed properties and drops empty values", () => {
    expect(funnelEvents).toEqual([
      "seo_page_view",
      "source_tab_opened",
      "source_copied",
      "customize_clicked",
      "template_used",
      "generation_started",
      "generation_succeeded",
      "signup_completed",
      "form_created",
      "form_published",
      "webhook_connected",
      "webhook_tested",
    ]);
    expect(
      funnelProperties({
        page: " /shadcn/form-builder ",
        templateSlug: "",
        shadcnSlug: "form-builder",
        authenticated: false,
        referrer: `https://www.google.com/search?q=${"x".repeat(300)}`,
      }),
    ).toEqual({
      page: "/shadcn/form-builder",
      shadcnSlug: "form-builder",
      authenticated: false,
      referrer: `https://www.google.com/search?q=${"x".repeat(300)}`.slice(0, 180),
    });
  });
});
