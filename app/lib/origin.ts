const productionAppOrigin = "https://formsquid.com";

export function appOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_ORIGIN?.replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return productionAppOrigin;
  return "http://localhost:3000";
}

const productionApiOrigin = "https://api.formsquid.com";

export function submitUrlFor(slug: string) {
  return `${apiOriginFor()}/forms/${slug}/submissions`;
}

export function uploadUrlFor(slug: string) {
  return `${apiOriginFor()}/forms/${slug}/uploads`;
}

function apiOriginFor() {
  const configured = process.env.FORM_API_ORIGIN?.replace(/\/$/, "");
  const apiOrigin = configured || (process.env.NODE_ENV === "production" ? productionApiOrigin : "");
  if (!apiOrigin) {
    throw new Error("FORM_API_ORIGIN must be configured.");
  }
  return apiOrigin;
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
