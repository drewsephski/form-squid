import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { aiFormSpecSchema, formSpecSchema, type FormSpec } from "./definitions";
import { normalizeFormSpec } from "./normalize-form-spec";

const instructions = [
  "Design one form.",
  "schemaVersion is 1.",
  "Field ids match /^[a-z][a-z0-9_]{0,63}$/ and are unique.",
  "Use nullable description, placeholder, options, and visibleWhen. Do not omit those keys.",
  "visibleWhen may only reference an earlier field.",
  "checkbox is one boolean, not a group.",
  "select and radio need unique options.",
  "Use type file for resumes, screenshots, project briefs, and attachments.",
  "For file fields set maxFiles to 1 or 5, maxFileSizeMb as a positive integer, and accept as a MIME list or null.",
  "No HTML.",
  "At most 5 steps and 40 fields.",
].join(" ");

const openrouter = createOpenRouter({
  appName: "FormSquid",
  appUrl: process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000",
});

export async function generateFormSpec(prompt: string, current?: FormSpec): Promise<FormSpec> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("Set OPENROUTER_API_KEY to generate forms.");
  }

  const modelId = process.env.FORM_MODEL ?? "openai/gpt-5.6-luna";
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { output } = await generateText({
        model: openrouter.chat(modelId, { structuredOutputs: { strict: false } }),
        output: Output.object({ schema: aiFormSpecSchema }),
        prompt: [
          instructions,
          current ? `Current spec:\n${JSON.stringify(current)}\n\nApply this change: ${prompt}` : `Create this form: ${prompt}`,
          lastError ? `The last result failed validation:\n${lastError}` : "",
        ].join("\n\n"),
      });
      return withAppearance(normalizeFormSpec(output), current);
    } catch (error) {
      const text = NoObjectGeneratedError.isInstance(error) ? error.text : undefined;
      if (text) {
        try {
          return withAppearance(normalizeFormSpec(JSON.parse(text)), current);
        } catch (parseError) {
          lastError = parseError instanceof Error ? parseError.message : "Invalid form";
          continue;
        }
      }
      lastError = error instanceof Error ? error.message : "Invalid form";
    }
  }

  throw new Error(lastError || "Could not generate a valid form.");
}

function withAppearance(spec: FormSpec, current?: FormSpec) {
  if (!current?.appearance) {
    return spec;
  }
  return formSpecSchema.parse({ ...spec, appearance: current.appearance });
}
