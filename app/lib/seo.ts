import type { Metadata } from "next";

export const siteOrigin = "https://formsquid.com";

export function pageMetadata(input: { title: string; description: string; path: string }): Metadata {
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      title: input.title,
      description: input.description,
      url: input.path,
      siteName: "FormSquid",
      type: "website",
    },
    robots: { index: true, follow: true },
  };
}
