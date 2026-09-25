import type { MetadataRoute } from "next";
import { siteOrigin } from "./lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/f/", "/forms", "/account", "/r/"],
    },
    sitemap: new URL("/sitemap.xml", siteOrigin).toString(),
  };
}
