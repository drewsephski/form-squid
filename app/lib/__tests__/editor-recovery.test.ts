import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { clearEditorRecovery, editorRecoveryKey, parseEditorRecovery, readEditorRecovery, storeEditorRecovery } from "../editor-recovery";
import { contact } from "../templates/contact";

describe("editor recovery", () => {
  const values = new Map<string, string>();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const key = editorRecoveryKey("owner", "form");
  const original = contact.spec;
  const edited = { ...original, title: "Updated title" };

  beforeEach(() => {
    values.clear();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (name: string) => values.get(name) ?? null,
          setItem: (name: string, value: string) => values.set(name, value),
          removeItem: (name: string) => values.delete(name),
        },
        dispatchEvent: jest.fn(),
      },
    });
  });

  afterEach(() => {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
  });

  test("keeps the unsaved spec, address and server baseline for explicit recovery", () => {
    expect(storeEditorRecovery(key, edited, "new-address", original, "contact")).toBe(true);
    expect(parseEditorRecovery(readEditorRecovery(key))).toMatchObject({
      spec: edited, slug: "new-address", baseSpec: JSON.stringify(original), baseSlug: "contact",
    });
  });

  test("recovers temporarily blank required copy without accepting malformed structures", () => {
    const blank = {
      ...edited, title: "", submitLabel: "", successMessage: "",
      steps: edited.steps.map((step) => ({ ...step, title: "", fields: step.fields.map((field) => ({ ...field, label: "" })) })),
    };
    storeEditorRecovery(key, blank, "", original, "contact");
    expect(parseEditorRecovery(readEditorRecovery(key))?.spec).toEqual(blank);
    const raw = JSON.parse(readEditorRecovery(key)!);
    raw.spec.steps = [{ fields: null }];
    expect(parseEditorRecovery(JSON.stringify(raw))).toBeNull();
  });

  test("an earlier save acknowledgement cannot discard newer edits", () => {
    storeEditorRecovery(key, edited, "new-address", original, "contact");
    expect(clearEditorRecovery(key, { spec: original, slug: "contact" })).toBe(false);
    expect(parseEditorRecovery(readEditorRecovery(key))?.spec).toEqual(edited);
    expect(clearEditorRecovery(key, { spec: edited, slug: "new-address" })).toBe(true);
    expect(readEditorRecovery(key)).toBeNull();
  });

  test("preserves overlong copy while the editor shows a save validation error", () => {
    const overlong = { ...edited, title: "a".repeat(201), description: "b".repeat(1001) };
    expect(storeEditorRecovery(key, overlong, "address", original, "contact")).toBe(true);
    expect(parseEditorRecovery(readEditorRecovery(key))?.spec).toEqual(overlong);
  });

  test("discard clears only this owner's form", () => {
    const otherOwner = editorRecoveryKey("another-owner", "form");
    const otherForm = editorRecoveryKey("owner", "another-form");
    for (const name of [key, otherOwner, otherForm]) storeEditorRecovery(name, edited, "contact", original, "contact");
    clearEditorRecovery(key);
    expect(readEditorRecovery(key)).toBeNull();
    expect(readEditorRecovery(otherOwner)).not.toBeNull();
    expect(readEditorRecovery(otherForm)).not.toBeNull();
    expect(editorRecoveryKey("a:b", "c")).not.toEqual(editorRecoveryKey("a", "b:c"));
  });

  test("rejects corrupt, expired, and future backups", () => {
    storeEditorRecovery(key, edited, "contact", original, "contact");
    const raw = readEditorRecovery(key)!;
    const time = JSON.parse(raw).savedAt;
    expect(parseEditorRecovery(raw, time + 8 * 24 * 60 * 60 * 1000)).toBeNull();
    expect(parseEditorRecovery(raw, time - 1)).toBeNull();
    expect(parseEditorRecovery("not json")).toBeNull();
    expect(parseEditorRecovery("null")).toBeNull();
  });

  test("reports blocked storage without breaking editing", () => {
    Object.defineProperty(globalThis, "window", { configurable: true, value: {
      get localStorage() { throw new Error("Blocked"); },
    } });
    expect(storeEditorRecovery(key, edited, "contact", original, "contact")).toBe(false);
    expect(readEditorRecovery(key)).toBeNull();
    expect(clearEditorRecovery(key)).toBe(false);
  });
});
