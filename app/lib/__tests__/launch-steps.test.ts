import { describe, expect, test } from "@jest/globals";
import { deriveLaunchState } from "../launch-steps";

describe("deriveLaunchState", () => {
  test("hides the checklist when unpublished", () => {
    const state = deriveLaunchState({
      published: false,
      notifyEmail: "",
      webhookEnabled: false,
      submissionCount: 0,
    });
    expect(state.visible).toBe(false);
    expect(state.collecting).toBe(false);
    expect(state.steps).toEqual([]);
  });

  test("published with zero responses and no email or webhook", () => {
    const state = deriveLaunchState({
      published: true,
      notifyEmail: "",
      webhookEnabled: false,
      submissionCount: 0,
    });
    expect(state.visible).toBe(true);
    expect(state.collecting).toBe(false);
    expect(state.steps.find((step) => step.id === "share")?.complete).toBe(true);
    expect(state.steps.find((step) => step.id === "notifications")?.complete).toBe(false);
    expect(state.steps.find((step) => step.id === "webhook")?.complete).toBe(false);
    expect(state.steps.find((step) => step.id === "firstResponse")?.complete).toBe(false);
    expect(state.steps.find((step) => step.id === "source")?.tab).toBe("code");
  });

  test("marks notifications complete when email is configured", () => {
    const state = deriveLaunchState({
      published: true,
      notifyEmail: "owner@example.com",
      webhookEnabled: false,
      submissionCount: 0,
    });
    expect(state.steps.find((step) => step.id === "notifications")?.complete).toBe(true);
    expect(state.steps.find((step) => step.id === "notifications")?.actionLabel).toBeUndefined();
  });

  test("marks webhook complete when an enabled webhook exists", () => {
    const state = deriveLaunchState({
      published: true,
      notifyEmail: "",
      webhookEnabled: true,
      submissionCount: 0,
    });
    expect(state.steps.find((step) => step.id === "webhook")?.complete).toBe(true);
  });

  test("marks collecting after the first response", () => {
    const state = deriveLaunchState({
      published: true,
      notifyEmail: "owner@example.com",
      webhookEnabled: true,
      submissionCount: 1,
    });
    expect(state.collecting).toBe(true);
    expect(state.steps.find((step) => step.id === "firstResponse")?.complete).toBe(true);
  });

  test("trims whitespace-only notification emails", () => {
    const state = deriveLaunchState({
      published: true,
      notifyEmail: "   ",
      webhookEnabled: false,
      submissionCount: 0,
    });
    expect(state.steps.find((step) => step.id === "notifications")?.complete).toBe(false);
  });
});
