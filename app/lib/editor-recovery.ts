import { z } from "zod";
import { fieldSchema, formSpecSchema, optionSchema, stepSchema, visibleWhenSchema, type FormSpec } from "./definitions";

// Editing can temporarily leave required copy blank or conditions invalid.
// Recover the editor's shape; publishing still uses the strict form schema.
const copy = z.string();
const recoverySpecSchema = z.object({
  ...formSpecSchema.shape,
  title: copy,
  description: copy.optional(),
  submitLabel: copy,
  successMessage: copy,
  steps: z.array(stepSchema.extend({
    title: copy,
    fields: z.array(fieldSchema.extend({
      label: copy,
      description: copy.optional(),
      placeholder: copy.optional(),
      options: z.array(optionSchema.extend({ value: copy, label: copy })).max(20).optional(),
      visibleWhen: visibleWhenSchema.extend({ equals: copy }).optional(),
    })).min(1).max(40),
  })).min(1).max(5),
});

const recoverySchema = z.object({
  version: z.literal(1),
  savedAt: z.number(),
  spec: recoverySpecSchema,
  slug: z.string(),
  baseSpec: z.string(),
  baseSlug: z.string(),
});

export type EditorRecovery = z.infer<typeof recoverySchema>;
const changedEvent = "formsquid:editor-recovery-changed";
const maxAge = 7 * 24 * 60 * 60 * 1000;
const maxSnapshotLength = 2 * 1024 * 1024;

export function editorRecoveryKey(ownerId: string, formId: string) {
  return `formsquid:editor-recovery:${encodeURIComponent(ownerId)}:${encodeURIComponent(formId)}`;
}

export function parseEditorRecovery(raw: string | null, now = Date.now()): EditorRecovery | null {
  if (!raw || raw.length > maxSnapshotLength) return null;
  try {
    const decoded: unknown = JSON.parse(raw);
    const result = recoverySchema.safeParse(decoded);
    if (!result.success || now - result.data.savedAt > maxAge || result.data.savedAt > now) return null;
    // Validation may reorder object keys. Keep the original validated spec so
    // its identity matches the editor's JSON-based saved-state comparison.
    return { ...result.data, spec: (decoded as EditorRecovery).spec };
  } catch {
    return null;
  }
}

export function readEditorRecovery(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function subscribeEditorRecovery(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(changedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(changedEvent, onChange);
  };
}

export function storeEditorRecovery(key: string, spec: FormSpec, slug: string, baseSpec: FormSpec, baseSlug: string): boolean {
  try {
    const snapshot = JSON.stringify({
      version: 1, savedAt: Date.now(), spec, slug, baseSpec: JSON.stringify(baseSpec), baseSlug,
    });
    if (!parseEditorRecovery(snapshot)) return false;
    window.localStorage.setItem(key, snapshot);
    window.dispatchEvent(new Event(changedEvent));
    return true;
  } catch {
    return false;
  }
}

export function clearEditorRecovery(key: string, saved?: { spec: FormSpec; slug: string }): boolean {
  try {
    if (saved) {
      const recovery = parseEditorRecovery(readEditorRecovery(key));
      // An older save must never remove edits made while that save was running.
      if (recovery && (JSON.stringify(recovery.spec) !== JSON.stringify(saved.spec) || recovery.slug !== saved.slug)) return false;
    }
    window.localStorage.removeItem(key);
    window.dispatchEvent(new Event(changedEvent));
    return true;
  } catch {
    return false;
  }
}
