import type { FormField } from "./definitions";
import {
  defaultAcceptMimeTypes,
  effectiveMaxFileSizeMb,
  effectiveMaxFiles,
  maxFileSizeBytes,
} from "./upload-limits";

export function fileFieldSettings(field: FormField) {
  return {
    maxFiles: effectiveMaxFiles(field.maxFiles),
    maxFileSizeMb: effectiveMaxFileSizeMb(field.maxFileSizeMb),
    maxFileSizeBytes: maxFileSizeBytes(field.maxFileSizeMb),
    accept: field.accept && field.accept.length > 0 ? field.accept : [...defaultAcceptMimeTypes],
  };
}

export function acceptAttribute(accept: string[]) {
  return accept.join(",");
}

export function mimeAllowed(contentType: string, accept: string[]) {
  const normalized = contentType.trim().toLowerCase();
  if (!normalized || normalized.includes(";") || normalized.includes(" ")) {
    return false;
  }
  return accept.some((rule) => {
    const pattern = rule.trim().toLowerCase();
    if (!pattern) {
      return false;
    }
    if (pattern.endsWith("/*")) {
      return normalized.startsWith(pattern.slice(0, -1));
    }
    if (pattern.startsWith(".")) {
      return false;
    }
    return normalized === pattern;
  });
}

export function sanitizeDisplayFilename(raw: string, maxBytes = 200) {
  const base = raw.replace(/\\/g, "/").split("/").pop() ?? "file";
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"|?*]/g, "_")
    .trim()
    .replace(/^\.+/, "");
  const fallback = cleaned || "file";
  const encoder = new TextEncoder();
  const bytes = encoder.encode(fallback);
  if (bytes.length <= maxBytes) {
    return fallback;
  }
  let end = fallback.length;
  while (end > 1 && encoder.encode(fallback.slice(0, end)).length > maxBytes) {
    end -= 1;
  }
  return fallback.slice(0, end) || "file";
}

export function contentDispositionAttachment(filename: string) {
  const safe = sanitizeDisplayFilename(filename).replace(/"/g, "");
  const encoded = encodeURIComponent(safe);
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "0 B";
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUploadId(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

export function isSubmissionFileRef(value: unknown): value is {
  id: string;
  name: string;
  contentType: string;
  size: number;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.contentType === "string" &&
    typeof record.size === "number" &&
    Number.isFinite(record.size)
  );
}

export function isBrowserFileLike(value: unknown): value is { name: string; size: number; type: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record.name === "string" && typeof record.size === "number" && typeof record.type === "string";
}
