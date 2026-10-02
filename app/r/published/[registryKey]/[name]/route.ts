import { NextResponse } from "next/server";
import { submitUrlFor, uploadUrlFor } from "@/app/lib/origin";
import { getPublishedByRegistryKey } from "@/app/lib/published";
import { createRegistryIndex, createRegistryItem, publishedFormDescription } from "@/app/lib/shadcn/registry";

export async function GET(_request: Request, context: { params: Promise<{ registryKey: string; name: string }> }) {
  const { registryKey, name } = await context.params;
  const itemName = name.replace(/\.json$/, "");
  const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "private, no-store" } });
  if (!/^[a-f0-9]{48}$/.test(registryKey)) return notFound();
  const published = await getPublishedByRegistryKey(registryKey);
  if (!published || (itemName !== "registry" && itemName !== "published-form")) return notFound();

  const result = itemName === "registry"
    ? createRegistryIndex([{ name: "published-form", title: published.spec.title, description: publishedFormDescription }])
    : createRegistryItem("published-form", published.spec, {
        submission: "formsquid",
        url: submitUrlFor(published.slug),
        uploadUrl: uploadUrlFor(published.slug),
      }, publishedFormDescription);
  return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
