import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { clearBrowserDraft, generatorPromptKey, parseBrowserDraft, readBrowserDraftSnapshot, storeDraftPrompt, storePendingSpec } from "../browser-draft";
import { pendingSpecKey } from "../definitions";
import { contact } from "../templates/contact";

describe("browser draft recovery", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: jest.fn((key: string) => values.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn((key: string) => { values.delete(key); }),
  };
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

  beforeEach(() => {
    values.clear();
    jest.clearAllMocks();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { localStorage: storage, dispatchEvent: jest.fn() },
    });
  });

  afterEach(() => {
    if (previousWindow) {
      Object.defineProperty(globalThis, "window", previousWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  });

  test("recovers the prompt and generated form from the existing signup key", () => {
    expect(storeDraftPrompt("A contact form for my studio")).toBe(true);
    expect(storePendingSpec(contact.spec)).toBe(true);
    expect(values.get(pendingSpecKey)).toBe(JSON.stringify(contact.spec));
    expect(parseBrowserDraft(readBrowserDraftSnapshot())).toEqual({
      prompt: "A contact form for my studio",
      spec: contact.spec,
    });
  });

  test("recovers a legacy pending form without a stored prompt", () => {
    values.set(pendingSpecKey, JSON.stringify(contact.spec));
    expect(parseBrowserDraft(readBrowserDraftSnapshot())).toEqual({ prompt: "", spec: contact.spec });
  });

  test.each(["not json", "null", JSON.stringify({ title: "Invalid form" })])(
    "preserves the prompt when the saved form is damaged: %s",
    (saved) => {
      values.set(generatorPromptKey, "Keep this prompt");
      values.set(pendingSpecKey, saved);
      expect(parseBrowserDraft(readBrowserDraftSnapshot())).toEqual({ prompt: "Keep this prompt", spec: null });
    },
  );

  test("rejects corrupt snapshots without throwing", () => {
    expect(parseBrowserDraft("broken")).toEqual({ prompt: "", spec: null });
    expect(parseBrowserDraft(JSON.stringify({ prompt: 123, spec: false }))).toEqual({ prompt: "", spec: null });
  });

  test("clears the prompt and form while preserving unrelated browser data", () => {
    values.set(generatorPromptKey, "Contact form");
    values.set(pendingSpecKey, JSON.stringify(contact.spec));
    values.set("unrelated", "keep");
    expect(clearBrowserDraft()).toBe(true);
    expect(parseBrowserDraft(readBrowserDraftSnapshot())).toEqual({ prompt: "", spec: null });
    expect(values.get("unrelated")).toBe("keep");
  });

  test("reports unavailable browser storage instead of breaking the flow", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        get localStorage() { throw new Error("Storage blocked"); },
      },
    });
    expect(readBrowserDraftSnapshot()).toBeNull();
    expect(storeDraftPrompt("Contact form")).toBe(false);
    expect(storePendingSpec(contact.spec)).toBe(false);
    expect(clearBrowserDraft()).toBe(false);
  });

  test("reports quota exhaustion and keeps the previous generated form", () => {
    values.set(pendingSpecKey, JSON.stringify(contact.spec));
    storage.setItem.mockImplementationOnce(() => { throw new Error("Quota exceeded"); });
    expect(storePendingSpec({ ...contact.spec, title: "New form" })).toBe(false);
    expect(parseBrowserDraft(readBrowserDraftSnapshot()).spec).toEqual(contact.spec);
  });
});
