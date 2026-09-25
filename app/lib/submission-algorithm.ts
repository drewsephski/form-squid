import type {
  FormField,
  FormSpec,
  SubmissionData,
  SubmissionFileRef,
  SubmissionResult,
  SubmissionValue,
} from "./definitions";
import {
  fileFieldSettings,
  isBrowserFileLike,
  isSubmissionFileRef,
  isUploadId,
  mimeAllowed,
} from "./file-field";

function fieldsInOrder(spec: FormSpec): FormField[] {
  return spec.steps.flatMap((step) => step.fields);
}

function findField(spec: FormSpec, id: string): FormField | undefined {
  return fieldsInOrder(spec).find((field) => field.id === id);
}

function stepIdForField(spec: FormSpec, id: string): string | undefined {
  return spec.steps.find((step) => step.fields.some((field) => field.id === id))?.id;
}

function plainRecord(payload: unknown): Record<string, unknown> | null {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record: Record<string, unknown> = Object.create(null);
  for (const key of Object.keys(payload)) {
    record[key] = (payload as Record<string, unknown>)[key];
  }
  return record;
}

function valueEquals(field: FormField, value: unknown, equals: string): boolean {
  if (field.type === "checkbox") {
    return (value === true && equals === "true") || (value === false && equals === "false");
  }

  if (field.type === "number") {
    return typeof value === "number" && Number.isFinite(value) && JSON.stringify(value) === equals;
  }

  return typeof value === "string" && value === equals;
}

function isVisible(
  spec: FormSpec,
  data: Record<string, unknown>,
  field: FormField,
  cache: Map<string, boolean>,
): boolean {
  const cached = cache.get(field.id);
  if (cached !== undefined) {
    return cached;
  }

  if (!field.visibleWhen) {
    cache.set(field.id, true);
    return true;
  }

  const parent = findField(spec, field.visibleWhen.fieldId);
  if (!parent || !isVisible(spec, data, parent, cache)) {
    cache.set(field.id, false);
    return false;
  }

  const visible = valueEquals(parent, data[parent.id], field.visibleWhen.equals);
  cache.set(field.id, visible);
  return visible;
}

function fileItems(value: unknown): unknown[] {
  if (value === undefined || value === null || value === "") {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function fileTypeError(field: FormField, value: unknown): string | null {
  const settings = fileFieldSettings(field);
  const items = fileItems(value);

  if (items.length === 0) {
    return field.required ? "This field is required." : null;
  }

  if (items.length > settings.maxFiles) {
    return settings.maxFiles === 1 ? "Upload one file." : `Upload up to ${settings.maxFiles} files.`;
  }

  for (const item of items) {
    if (isUploadId(item)) {
      continue;
    }

    if (isSubmissionFileRef(item)) {
      if (item.size > settings.maxFileSizeBytes) {
        return `File must be ${settings.maxFileSizeMb} MB or smaller.`;
      }
      if (!mimeAllowed(item.contentType, settings.accept)) {
        return "This file type is not allowed.";
      }
      continue;
    }

    if (isBrowserFileLike(item)) {
      if (item.size > settings.maxFileSizeBytes) {
        return `File must be ${settings.maxFileSizeMb} MB or smaller.`;
      }
      const contentType = item.type || "application/octet-stream";
      if (!mimeAllowed(contentType, settings.accept)) {
        return "This file type is not allowed.";
      }
      continue;
    }

    return "Upload a valid file.";
  }

  return null;
}

function normalizeFileValue(field: FormField, value: unknown): SubmissionValue | undefined {
  const items = fileItems(value);
  if (items.length === 0) {
    return undefined;
  }

  const settings = fileFieldSettings(field);
  if (items.every(isUploadId)) {
    return settings.maxFiles === 1 ? (items[0] as string) : (items as string[]);
  }

  if (items.every(isSubmissionFileRef)) {
    const refs = items as SubmissionFileRef[];
    return settings.maxFiles === 1 ? refs[0]! : refs;
  }

  // Callback-only browser File objects stay as-is for the consumer.
  return value as SubmissionValue;
}

function typeError(field: FormField, value: unknown): string | null {
  if (field.type === "file") {
    return fileTypeError(field, value);
  }

  if (field.type === "checkbox") {
    if (typeof value !== "boolean") {
      return "Enter a true or false value.";
    }
    if (field.required && value !== true) {
      return "This field is required.";
    }
    return null;
  }

  if (field.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "Enter a number.";
    }
    return null;
  }

  if (typeof value !== "string") {
    return "Enter text.";
  }

  if (value.length > 5000) {
    return "Use 5000 characters or fewer.";
  }

  if (field.required && value.trim() === "") {
    return "This field is required.";
  }

  if (value.trim() === "") {
    return null;
  }

  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "Enter a valid email.";
  }

  if (field.type === "date" && !isIsoDate(value)) {
    return "Enter a valid date.";
  }

  if (
    (field.type === "select" || field.type === "radio") &&
    !field.options?.some((option) => option.value === value)
  ) {
    return "Choose an option.";
  }

  return null;
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function fieldIsVisible(
  spec: FormSpec,
  data: Record<string, unknown>,
  field: FormField,
): boolean {
  return isVisible(spec, data, field, new Map());
}

export function validatePayload(
  spec: FormSpec,
  payload: unknown,
  stepId?: string,
): SubmissionResult {
  if (stepId && !spec.steps.some((step) => step.id === stepId)) {
    return { ok: false, errors: [{ path: "", message: "Unknown step." }] };
  }

  const data = plainRecord(payload);
  if (!data) {
    return { ok: false, errors: [{ path: "", message: "Expected an object." }] };
  }

  const fields = fieldsInOrder(spec);
  const known = new Set(fields.map((field) => field.id));
  const errors: { path: string; message: string }[] = [];

  for (const key of Object.keys(data)) {
    if (!known.has(key)) {
      errors.push({ path: key, message: "Unknown field." });
    }
  }

  const cache = new Map<string, boolean>();
  const normalized: SubmissionData = Object.create(null);

  for (const field of fields) {
    const visible = isVisible(spec, data, field, cache);
    const inStep = !stepId || stepIdForField(spec, field.id) === stepId;
    if (!visible || !inStep) {
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(data, field.id)) {
      if (field.type === "checkbox" && !field.required) {
        normalized[field.id] = false;
        continue;
      }
      if (field.required) {
        errors.push({ path: field.id, message: "This field is required." });
      }
      continue;
    }

    const message = typeError(field, data[field.id]);
    if (message) {
      errors.push({ path: field.id, message });
      continue;
    }

    if (field.type === "file") {
      const fileValue = normalizeFileValue(field, data[field.id]);
      if (fileValue !== undefined) {
        normalized[field.id] = fileValue;
      }
      continue;
    }

    normalized[field.id] = data[field.id] as SubmissionValue;
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, data: { ...normalized } };
}
