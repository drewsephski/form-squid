import { describe, expect, test } from "@jest/globals";
import { formSpecSchema, type FormSpec } from "../definitions";
import { addField, addOption, addStep, changeFieldType, deleteField, deleteStep, moveField, removeOption, setVisibleWhen, specIssue } from "../edit-spec";

const contact: FormSpec = {
  schemaVersion: 1,
  title: "Contact",
  submitLabel: "Send",
  successMessage: "Thanks",
  steps: [
    {
      id: "main",
      title: "Details",
      fields: [
        { id: "name", type: "text", label: "Name", required: true },
        { id: "email", type: "email", label: "Email", required: true },
      ],
    },
  ],
};

describe("edit-spec", () => {
  test("adds a field and a choice field with an option", () => {
    const added = addField(contact, "main", "select");
    expect("spec" in added).toBe(true);
    if (!("spec" in added)) {
      return;
    }
    const field = added.spec.steps[0]?.fields.at(-1);
    expect(field?.type).toBe("select");
    expect(field?.options).toEqual([{ value: "option_1", label: "Option 1" }]);
    expect(specIssue(added.spec)).toBeNull();
  });

  test("strips options when a choice field becomes text", () => {
    const added = addField(contact, "main", "radio");
    if (!("spec" in added)) {
      throw new Error("expected a field");
    }
    const fieldId = added.fieldId;
    const next = changeFieldType(added.spec, fieldId, "text");
    const field = next.steps[0]?.fields.find((item) => item.id === fieldId);
    expect(field?.type).toBe("text");
    expect(field?.options).toBeUndefined();
    expect(formSpecSchema.safeParse(next).success).toBe(true);
  });

  test("refuses to delete the last field", () => {
    const only = deleteField(
      {
        ...contact,
        steps: [{ id: "main", title: "Details", fields: [contact.steps[0]!.fields[0]!] }],
      },
      "name",
    );
    expect(only).toEqual({ error: "A form needs at least one field." });
  });

  test("removes an emptied step when another step remains", () => {
    const stepped = addStep(contact);
    if (!("spec" in stepped)) {
      throw new Error("expected a step");
    }
    const extraId = stepped.spec.steps[1]?.fields[0]?.id;
    if (!extraId) {
      throw new Error("expected a field");
    }
    const removed = deleteField(stepped.spec, extraId);
    expect("spec" in removed && removed.spec.steps).toHaveLength(1);
  });

  test("keeps at least one option", () => {
    const added = addField(contact, "main", "select");
    if (!("spec" in added)) {
      throw new Error("expected a field");
    }
    const removed = removeOption(added.spec, added.fieldId, 0);
    expect(removed).toEqual({ error: "Add at least one option." });
    const withTwo = addOption(added.spec, added.fieldId);
    const trimmed = removeOption(withTwo, added.fieldId, 0);
    expect("spec" in trimmed && trimmed.spec.steps[0]?.fields.at(-1)?.options).toHaveLength(1);
  });

  test("refuses a sixth step", () => {
    let current = contact;
    for (let index = 0; index < 4; index += 1) {
      const next = addStep(current);
      if (!("spec" in next)) {
        throw new Error("expected a step");
      }
      current = next.spec;
    }
    expect(addStep(current)).toEqual({ error: "A form can have at most 5 steps." });
  });

  test("refuses to delete the only step", () => {
    expect(deleteStep(contact, "main")).toEqual({ error: "A form needs at least one step." });
  });

  test("keeps a condition only while the parent stays earlier", () => {
    const conditioned = setVisibleWhen(contact, "email", { fieldId: "name", equals: "Ada" });
    expect(specIssue(conditioned)).toBeNull();
    const moved = moveField(conditioned, "email", -1);
    const field = moved.steps[0]?.fields.find((item) => item.id === "email");
    expect(field?.visibleWhen).toBeUndefined();
    expect(specIssue(moved)).toBeNull();
  });
});
