import { NextResponse } from "next/server";
import { submitUrlFor, uploadUrlFor } from "@/app/lib/origin";
import { getPublishedByRegistryKey } from "@/app/lib/published";
import { createFormHelperItem, createRegistryIndex, createRegistryItem, publishedFormDescription, registryForms } from "@/app/lib/shadcn/registry";

export async function GET(_request: Request, context: { params: Promise<{ registryKey: string }> }) {
  const { registryKey } = await context.params;
  const key = registryKey.replace(/\.json$/, "");
  if (key === "form-helper") {
    return NextResponse.json(createFormHelperItem());
  }
  if (key === "registry") {
    return NextResponse.json(createRegistryIndex(registryForms));
  }
  const example = registryForms.find((form) => form.name === key);
  if (example) {
    return NextResponse.json(createRegistryItem(example.name, example.spec, { submission: "callback" }, example.description));
  }
  if (!/^[a-f0-9]{48}$/.test(key)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const published = await getPublishedByRegistryKey(key);
  if (!published) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(createRegistryItem(published.slug, published.spec, {
    submission: "formsquid",
    url: submitUrlFor(published.slug),
    uploadUrl: uploadUrlFor(published.slug),
  }, publishedFormDescription), { headers: { "Cache-Control": "private, no-store" } });
}
