import { aiFormSpecSchema, formSpecSchema, type FormSpec } from "./definitions";

function omitNull<T>(value: T | null | undefined): T | undefined {
  return value === null || value === undefined ? undefined : value;
}

export function normalizeFormSpec(input: unknown): FormSpec {
  const parsed = aiFormSpecSchema.parse(input);

  return formSpecSchema.parse({
    schemaVersion: 1,
    title: parsed.title,
    description: omitNull(parsed.description),
    submitLabel: parsed.submitLabel,
    successMessage: parsed.successMessage,
    steps: parsed.steps.map((step) => ({
      id: step.id,
      title: step.title,
      fields: step.fields.map((field) => ({
        id: field.id,
        type: field.type,
        label: field.label,
        description: omitNull(field.description),
        placeholder: omitNull(field.placeholder),
        required: field.required,
        options: omitNull(field.options),
        visibleWhen: omitNull(field.visibleWhen),
        maxFiles: omitNull(field.maxFiles ?? null),
        maxFileSizeMb: omitNull(field.maxFileSizeMb ?? null),
        accept: omitNull(field.accept ?? null),
      })),
    })),
  });
}
