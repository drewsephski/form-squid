export function appOrigin() {
  return process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000";
}

const productionApiOrigin = "https://api.formsquid.com";

export function submitUrlFor(slug: string) {
  const configured = process.env.FORM_API_ORIGIN?.replace(/\/$/, "");
  const apiOrigin = configured || (process.env.NODE_ENV === "production" ? productionApiOrigin : "");
  if (!apiOrigin) {
    throw new Error("FORM_API_ORIGIN must be configured.");
  }
  return `${apiOrigin}/forms/${slug}/submissions`;
}

export function hostedHost(slug: string) {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "formsquid.com";
  return `${slug}.${root}`;
}

export function hostedUrl(slug: string, location?: { protocol: string; hostname: string; port: string }) {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "formsquid.com";
  const local = location && (location.hostname === "localhost" || location.hostname.endsWith(".localhost") || root === "localhost");
  if (local && location) {
    const port = location.port ? `:${location.port}` : "";
    return `${location.protocol}//${slug}.localhost${port}`;
  }
  return `https://${hostedHost(slug)}`;
}
