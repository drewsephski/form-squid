import type { MetadataRoute } from "next";
import { siteOrigin } from "./lib/seo";
import { shadcnPages } from "./lib/shadcn/pages";
import { templates } from "./lib/templates";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/templates", "/shadcn", ...templates.map((template) => `/templates/${template.slug}`), ...shadcnPages.map((page) => `/shadcn/${page.slug}`)];
  return paths.map((path) => ({
    url: new URL(path, siteOrigin).toString(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
