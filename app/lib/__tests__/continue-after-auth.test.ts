import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { saveForm } from "../actions/forms-write";
import { continueAfterAuth } from "../continue-after-auth";
import { generatorPromptKey } from "../browser-draft";
import { pendingSpecKey } from "../definitions";
import { contact } from "../templates/contact";

jest.mock("../actions/forms-write", () => ({ saveForm: jest.fn() }));
jest.mock("../analytics", () => ({ trackFunnel: jest.fn() }));

describe("draft handoff after authentication", () => {
  const values = new Map<string, string>();
  const router = { push: jest.fn() };
  const onError = jest.fn();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const mockedSave = jest.mocked(saveForm);

  beforeEach(() => {
    values.clear();
    jest.resetAllMocks();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => values.get(key) ?? null,
          removeItem: (key: string) => { values.delete(key); },
        },
        dispatchEvent: jest.fn(),
      },
    });
  });

  afterEach(() => {
    if (previousWindow) {
      Object.defineProperty(globalThis, "window", previousWindow);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  });

  test("keeps the form and prompt when the server cannot save the draft", async () => {
    values.set(pendingSpecKey, JSON.stringify(contact.spec));
    values.set(generatorPromptKey, "Contact form");
    mockedSave.mockRejectedValueOnce(new Error("Temporarily unavailable"));
    await continueAfterAuth({ page: "/sign-up", router, onError });
    expect(values.get(pendingSpecKey)).toBe(JSON.stringify(contact.spec));
    expect(values.get(generatorPromptKey)).toBe("Contact form");
    expect(onError).toHaveBeenCalledWith("Temporarily unavailable");
    expect(router.push).not.toHaveBeenCalled();
  });

  test("clears both keys only after a successful save and opens the editor", async () => {
    values.set(pendingSpecKey, JSON.stringify(contact.spec));
    values.set(generatorPromptKey, "Contact form");
    mockedSave.mockResolvedValueOnce({ id: "saved-form" });
    await continueAfterAuth({ page: "/sign-up", router, onError });
    expect(mockedSave).toHaveBeenCalledWith(contact.spec);
    expect(values.has(pendingSpecKey)).toBe(false);
    expect(values.has(generatorPromptKey)).toBe(false);
    expect(router.push).toHaveBeenCalledWith("/forms/saved-form");
    expect(onError).not.toHaveBeenCalled();
  });

  test("opens My forms without saving when there is no pending form", async () => {
    await continueAfterAuth({ page: "/sign-in", router, onError });
    expect(mockedSave).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith("/forms");
  });
});
