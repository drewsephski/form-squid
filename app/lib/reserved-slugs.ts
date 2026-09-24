export const reservedSlugs = new Set([
  "www",
  "api",
  "app",
  "admin",
  "docs",
  "status",
  "mail",
  "static",
  "assets",
  "cdn",
]);

export function assertPublicSlug(slug: string) {
  const next = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(next)) {
    throw new Error("Use a lowercase slug.");
  }
  if (reservedSlugs.has(next)) {
    throw new Error("That address is reserved.");
  }
  return next;
}
