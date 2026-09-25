import type { FormSpec } from "./definitions";

export interface LabeledAnswer {
  id: string;
  label: string;
  value: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(value: unknown) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return "";
}

export function labeledAnswers(spec: FormSpec | null, payload: unknown): LabeledAnswer[] {
  const data = isRecord(payload) ? payload : {};
  if (!spec) {
    return Object.entries(data).map(([id, value]) => ({
      id,
      label: id,
      value: textValue(value) || "—",
    }));
  }

  return spec.steps.flatMap((step) =>
    step.fields.map((field) => {
      const raw = data[field.id];
      let value = textValue(raw);
      if ((field.type === "select" || field.type === "radio") && typeof raw === "string") {
        value = field.options?.find((option) => option.value === raw)?.label ?? value;
      }
      return { id: field.id, label: field.label, value: value || "—" };
    }),
  );
}

export function submissionIdentity(spec: FormSpec | null, payload: unknown) {
  const answers = labeledAnswers(spec, payload).filter((answer) => answer.value !== "—");
  const fields = spec?.steps.flatMap((step) => step.fields) ?? [];
  const data = isRecord(payload) ? payload : {};

  const nameField = fields.find((field) => /name/i.test(field.label) || /name/i.test(field.id));
  const emailField = fields.find((field) => field.type === "email");
  const name = nameField ? textValue(data[nameField.id]) : "";
  const email = emailField ? textValue(data[emailField.id]) : answers.find((answer) => answer.value.includes("@"))?.value ?? "";
  const title = name || email || answers[0]?.value || "Response";
  const detail = name && email ? email : "";

  return { title, detail };
}

export function submissionSearchText(spec: FormSpec | null, payload: unknown) {
  return labeledAnswers(spec, payload)
    .map((answer) => `${answer.label} ${answer.value}`)
    .join(" ")
    .toLowerCase();
}

