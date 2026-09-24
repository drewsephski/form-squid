import { reservedSlugs } from "./reserved-slugs";

export function formHostSlug(hostname: string, rootDomain: string): string | null {
  const host = hostname.split(":")[0]?.toLowerCase() ?? "";
  let slug = "";

  if (host.endsWith(".localhost")) {
    slug = host.slice(0, -".localhost".length);
  } else if (rootDomain && host.endsWith(`.${rootDomain}`) && host !== rootDomain && host !== `www.${rootDomain}`) {
    slug = host.slice(0, -(rootDomain.length + 1));
  }

  if (!slug || slug.includes(".") || reservedSlugs.has(slug)) {
    return null;
  }

  return slug;
}
