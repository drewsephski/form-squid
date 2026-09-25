import { NextResponse } from "next/server";
import { compileForm } from "@/app/lib/compiler";
import { submitUrlFor } from "@/app/lib/origin";
import { getPublishedByRegistryKey } from "@/app/lib/published";

export async function GET(_request: Request, context: { params: Promise<{ registryKey: string }> }) {
  const { registryKey } = await context.params;
  const key = registryKey.replace(/\.json$/, "");
  const published = await getPublishedByRegistryKey(key);
  if (!published) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const compiled = compileForm(published.spec, { submission: "formsquid", url: submitUrlFor(published.slug) });
  return NextResponse.json({
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: published.slug,
    type: "registry:block",
    title: published.spec.title,
    dependencies: ["react-hook-form", "@hookform/resolvers", "zod"],
    registryDependencies: compiled.registryDependencies,
    files: [
      { path: "schema.ts", type: "registry:file", content: compiled.schemaSource },
      { path: "form.tsx", type: "registry:file", content: compiled.formSource },
    ],
  });
}
