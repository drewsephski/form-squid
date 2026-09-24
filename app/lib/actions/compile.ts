"use server";

import { compileForm } from "@/app/lib/compiler";
import { formSpecSchema } from "@/app/lib/definitions";
import { submitUrlFor } from "@/app/lib/origin";

export async function compileAction(input: unknown, slug: string) {
  const spec = formSpecSchema.parse(input);
  return compileForm(spec, submitUrlFor(slug));
}
