"use server";

import { generateFormSpec } from "@/app/lib/generate-spec";
import { consumeGeneration } from "@/app/lib/limits";
import { formSpecSchema, type FormSpec } from "@/app/lib/definitions";

function readableError(error: unknown) {
  const raw = error instanceof Error ? error.message : "Could not generate that form.";
  return raw.replace(/\u001b\[[0-9;]*m/g, "").replace(/\s+/g, " ").trim();
}

export async function generateAction(prompt: string, current?: FormSpec): Promise<{ spec?: FormSpec; error?: string }> {
  const trimmed = prompt.trim();
  if (trimmed.length < 8) {
    return { error: "Describe the form in a bit more detail." };
  }

  try {
    await consumeGeneration();
    const spec = await generateFormSpec(trimmed, current ? formSpecSchema.parse(current) : undefined);
    return { spec };
  } catch (error) {
    return { error: readableError(error) };
  }
}
