import { formSpecSchema, pendingSpecKey, type FormSpec } from "./definitions";

export const generatorPromptKey = "formsquid:generator-prompt";
const draftChangedEvent = "formsquid:draft-changed";

export function readBrowserDraftSnapshot(): string | null {
  try {
    return JSON.stringify({
      prompt: window.localStorage.getItem(generatorPromptKey) ?? "",
      spec: window.localStorage.getItem(pendingSpecKey),
    });
  } catch {
    return null;
  }
}

export function parseBrowserDraft(snapshot: string | null): { prompt: string; spec: FormSpec | null } {
  const empty = { prompt: "", spec: null };
  if (!snapshot) {
    return empty;
  }
  try {
    const stored = JSON.parse(snapshot);
    const prompt = typeof stored?.prompt === "string" ? stored.prompt : "";
    let spec: FormSpec | null = null;
    if (typeof stored?.spec === "string") {
      try {
        const result = formSpecSchema.safeParse(JSON.parse(stored.spec));
        if (result.success) {
          spec = result.data;
        }
      } catch {
        // A damaged form must not prevent recovery of the typed prompt.
      }
    }
    return { prompt, spec };
  } catch {
    return empty;
  }
}

export function subscribeBrowserDraft(onChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === null || event.key === generatorPromptKey || event.key === pendingSpecKey) {
      onChange();
    }
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener(draftChangedEvent, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(draftChangedEvent, onChange);
  };
}

export function storeDraftPrompt(prompt: string): boolean {
  try {
    window.localStorage.setItem(generatorPromptKey, prompt);
    window.dispatchEvent(new Event(draftChangedEvent));
    return true;
  } catch {
    return false;
  }
}

export function storePendingSpec(spec: FormSpec): boolean {
  try {
    window.localStorage.setItem(pendingSpecKey, JSON.stringify(spec));
    window.dispatchEvent(new Event(draftChangedEvent));
    return true;
  } catch {
    return false;
  }
}

export function clearBrowserDraft(): boolean {
  try {
    window.localStorage.removeItem(pendingSpecKey);
    window.localStorage.removeItem(generatorPromptKey);
    window.dispatchEvent(new Event(draftChangedEvent));
    return true;
  } catch {
    return false;
  }
}
