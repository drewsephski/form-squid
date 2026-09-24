export function appOrigin() {
  return process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000";
}

export function submitUrlFor(slug: string) {
  return `${appOrigin()}/api/submit/${slug}`;
}

export function hostedHost(slug: string) {
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "formsquid.com";
  return `${slug}.${root}`;
}
