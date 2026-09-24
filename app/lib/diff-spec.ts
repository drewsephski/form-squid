import type { FormSpec } from "./definitions";

export function describeSpecChange(before: FormSpec, after: FormSpec) {
  const previous = before.steps.flatMap((step) => step.fields);
  const next = after.steps.flatMap((step) => step.fields);
  const lines: string[] = [];
  if (before.title !== after.title) {
    lines.push(`Title: ${after.title}`);
  }
  if (before.steps.length !== after.steps.length) {
    lines.push(`Steps: ${before.steps.length} -> ${after.steps.length}`);
  }
  for (const field of next) {
    const prior = previous.find((item) => item.id === field.id);
    if (!prior) {
      lines.push(`Added ${field.label}`);
      continue;
    }
    if (prior.label !== field.label || prior.required !== field.required || prior.type !== field.type) {
      lines.push(`Updated ${field.label}`);
    }
  }
  for (const field of previous) {
    if (!next.some((item) => item.id === field.id)) {
      lines.push(`Removed ${field.label}`);
    }
  }
  return lines.length > 0 ? lines : ["No visible field changes."];
}
