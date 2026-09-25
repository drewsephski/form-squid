import { formSpecSchema, type FieldType, type FormField, type FormSpec } from "./definitions";

export const fieldTypeLabels: Record<FieldType, string> = {
  text: "Text",
  email: "Email",
  textarea: "Long text",
  number: "Number",
  select: "Dropdown",
  radio: "Radio",
  checkbox: "Checkbox",
  date: "Date",
  file: "File",
};

const maxFields = 40;
const maxSteps = 5;
const maxOptions = 20;

export function specIssue(spec: FormSpec) {
  const parsed = formSpecSchema.safeParse(spec);
  if (parsed.success) {
    return null;
  }
  return parsed.error.issues[0]?.message ?? "Fix the form before saving.";
}

export function specsMatch(left: FormSpec, right: FormSpec) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function takenIds(spec: FormSpec) {
  const ids = new Set<string>();
  for (const step of spec.steps) {
    ids.add(step.id);
    for (const field of step.fields) {
      ids.add(field.id);
    }
  }
  return ids;
}

export function uniqueId(preferred: string, taken: Set<string>) {
  const cleaned = preferred
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  const base = /^[a-z]/.test(cleaned) ? cleaned : `field_${cleaned || "new"}`;
  if (!taken.has(base)) {
    return base;
  }
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base.slice(0, 44)}_${index}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  return `${base.slice(0, 40)}_${taken.size + 1}`;
}

function optionValue(label: string, taken: Set<string>) {
  const cleaned = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const base = cleaned || "option";
  if (!taken.has(base)) {
    return base;
  }
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base.slice(0, 36)}_${index}`;
    if (!taken.has(candidate)) {
      return candidate;
    }
  }
  return `${base}_${taken.size + 1}`;
}

function choiceType(type: FieldType) {
  return type === "select" || type === "radio";
}

export function blankField(type: FieldType, taken: Set<string>): FormField {
  const field: FormField = {
    id: uniqueId(type === "text" ? "field" : type, taken),
    type,
    label: "New field",
    required: false,
  };
  if (choiceType(type)) {
    field.options = [{ value: "option_1", label: "Option 1" }];
  }
  if (type === "file") {
    field.maxFiles = 1;
    field.maxFileSizeMb = 10;
  }
  return field;
}

function fieldCount(spec: FormSpec) {
  return spec.steps.reduce((total, step) => total + step.fields.length, 0);
}

export function addField(spec: FormSpec, stepId: string, type: FieldType = "text") {
  if (fieldCount(spec) >= maxFields) {
    return { error: "A form can have at most 40 fields." };
  }
  const step = spec.steps.find((item) => item.id === stepId);
  if (!step) {
    return { error: "Step not found." };
  }
  if (step.fields.length >= maxFields) {
    return { error: "A step can have at most 40 fields." };
  }
  const field = blankField(type, takenIds(spec));
  return {
    fieldId: field.id,
    spec: {
      ...spec,
      steps: spec.steps.map((item) => (item.id === stepId ? { ...item, fields: [...item.fields, field] } : item)),
    },
  };
}

export function updateField(spec: FormSpec, fieldId: string, patch: Partial<Pick<FormField, "label" | "description" | "placeholder" | "required">>) {
  return {
    ...spec,
    steps: spec.steps.map((step) => ({
      ...step,
      fields: step.fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)),
    })),
  };
}

export function changeFieldType(spec: FormSpec, fieldId: string, type: FieldType) {
  return clearStaleConditions({
    ...spec,
    steps: spec.steps.map((step) => ({
      ...step,
      fields: step.fields.map((field) => {
        if (field.id !== fieldId) {
          return field;
        }
        if (type === "file") {
          const next: FormField = {
            ...field,
            type,
            maxFiles: field.maxFiles === 5 ? 5 : 1,
            maxFileSizeMb: field.maxFileSizeMb ?? 10,
          };
          delete next.options;
          return next;
        }
        if (!choiceType(type)) {
          const next = { ...field, type };
          delete next.options;
          delete next.maxFiles;
          delete next.maxFileSizeMb;
          delete next.accept;
          return next;
        }
        const next: FormField = {
          ...field,
          type,
          options: field.options && field.options.length > 0 ? field.options : [{ value: "option_1", label: "Option 1" }],
        };
        delete next.maxFiles;
        delete next.maxFileSizeMb;
        delete next.accept;
        return next;
      }),
    })),
  });
}

export function updateFileField(
  spec: FormSpec,
  fieldId: string,
  patch: Partial<Pick<FormField, "maxFiles" | "maxFileSizeMb" | "accept">>,
) {
  return {
    ...spec,
    steps: spec.steps.map((step) => ({
      ...step,
      fields: step.fields.map((field) => {
        if (field.id !== fieldId || field.type !== "file") {
          return field;
        }
        const next = { ...field, ...patch };
        if (patch.accept === undefined && "accept" in patch) {
          delete next.accept;
        }
        return next;
      }),
    })),
  };
}

function conditionValueOk(parent: FormField, equals: string) {
  if (parent.type === "checkbox") {
    return equals === "true" || equals === "false";
  }
  if (parent.type === "select" || parent.type === "radio") {
    return parent.options?.some((option) => option.value === equals) ?? false;
  }
  if (parent.type === "number") {
    const parsed = Number(equals);
    return Number.isFinite(parsed) && JSON.stringify(parsed) === equals;
  }
  return true;
}

export function clearStaleConditions(spec: FormSpec): FormSpec {
  const ordered = spec.steps.flatMap((step) => step.fields);
  const kept = new Map<string, FormField["visibleWhen"]>();
  ordered.forEach((field, index) => {
    const rule = field.visibleWhen;
    if (!rule) {
      return;
    }
    const parent = ordered.slice(0, index).find((item) => item.id === rule.fieldId);
    if (parent && conditionValueOk(parent, rule.equals)) {
      kept.set(field.id, rule);
    }
  });

  return {
    ...spec,
    steps: spec.steps.map((step) => ({
      ...step,
      fields: step.fields.map((field) => {
        const next = kept.get(field.id);
        if (next) {
          return { ...field, visibleWhen: next };
        }
        if (!field.visibleWhen) {
          return field;
        }
        const rest = { ...field };
        delete rest.visibleWhen;
        return rest;
      }),
    })),
  };
}

export function defaultConditionEquals(parent: FormField) {
  if (parent.type === "checkbox") {
    return "true";
  }
  if (parent.type === "select" || parent.type === "radio") {
    return parent.options?.[0]?.value ?? "";
  }
  if (parent.type === "number") {
    return "0";
  }
  return "";
}

export function setVisibleWhen(spec: FormSpec, fieldId: string, visibleWhen: FormField["visibleWhen"]) {
  return {
    ...spec,
    steps: spec.steps.map((step) => ({
      ...step,
      fields: step.fields.map((field) => {
        if (field.id !== fieldId) {
          return field;
        }
        if (!visibleWhen) {
          const rest = { ...field };
          delete rest.visibleWhen;
          return rest;
        }
        return { ...field, visibleWhen };
      }),
    })),
  };
}

export function earlierFields(spec: FormSpec, fieldId: string) {
  const ordered = spec.steps.flatMap((step) => step.fields);
  const index = ordered.findIndex((field) => field.id === fieldId);
  return index < 0 ? [] : ordered.slice(0, index);
}

export function moveField(spec: FormSpec, fieldId: string, direction: -1 | 1) {
  return clearStaleConditions({
    ...spec,
    steps: spec.steps.map((step) => {
      const index = step.fields.findIndex((field) => field.id === fieldId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= step.fields.length) {
        return step;
      }
      const fields = [...step.fields];
      const [item] = fields.splice(index, 1);
      if (!item) {
        return step;
      }
      fields.splice(nextIndex, 0, item);
      return { ...step, fields };
    }),
  });
}

export function deleteField(spec: FormSpec, fieldId: string) {
  const steps = spec.steps
    .map((step) => ({
      ...step,
      fields: step.fields
        .filter((field) => field.id !== fieldId)
        .map((field) => (field.visibleWhen?.fieldId === fieldId ? { ...field, visibleWhen: undefined } : field)),
    }))
    .filter((step) => step.fields.length > 0);

  if (steps.length === 0) {
    return { error: "A form needs at least one field." };
  }

  return { spec: { ...spec, steps } };
}

export function addOption(spec: FormSpec, fieldId: string) {
  return {
    ...spec,
    steps: spec.steps.map((step) => ({
      ...step,
      fields: step.fields.map((field) => {
        if (field.id !== fieldId || !field.options) {
          return field;
        }
        if (field.options.length >= maxOptions) {
          return field;
        }
        const taken = new Set(field.options.map((option) => option.value));
        const label = `Option ${field.options.length + 1}`;
        return { ...field, options: [...field.options, { value: optionValue(label, taken), label }] };
      }),
    })),
  };
}

export function updateOptionLabel(spec: FormSpec, fieldId: string, index: number, label: string) {
  return {
    ...spec,
    steps: spec.steps.map((step) => ({
      ...step,
      fields: step.fields.map((field) => {
        if (field.id !== fieldId || !field.options) {
          return field;
        }
        return {
          ...field,
          options: field.options.map((option, optionIndex) => (optionIndex === index ? { ...option, label } : option)),
        };
      }),
    })),
  };
}

export function removeOption(spec: FormSpec, fieldId: string, index: number) {
  const field = spec.steps.flatMap((step) => step.fields).find((item) => item.id === fieldId);
  if (field?.options && field.options.length <= 1) {
    return { error: "Add at least one option." };
  }
  return {
    spec: clearStaleConditions({
      ...spec,
      steps: spec.steps.map((step) => ({
        ...step,
        fields: step.fields.map((item) => {
          if (item.id !== fieldId || !item.options) {
            return item;
          }
          return { ...item, options: item.options.filter((_, optionIndex) => optionIndex !== index) };
        }),
      })),
    }),
  };
}

export function addStep(spec: FormSpec) {
  if (spec.steps.length >= maxSteps) {
    return { error: "A form can have at most 5 steps." };
  }
  if (fieldCount(spec) >= maxFields) {
    return { error: "A form can have at most 40 fields." };
  }
  const taken = takenIds(spec);
  const stepId = uniqueId("step", taken);
  taken.add(stepId);
  const field = blankField("text", taken);
  return {
    stepId,
    spec: {
      ...spec,
      steps: [...spec.steps, { id: stepId, title: `Step ${spec.steps.length + 1}`, fields: [field] }],
    },
  };
}

export function renameStep(spec: FormSpec, stepId: string, title: string) {
  return {
    ...spec,
    steps: spec.steps.map((step) => (step.id === stepId ? { ...step, title } : step)),
  };
}

export function moveStep(spec: FormSpec, stepId: string, direction: -1 | 1) {
  const index = spec.steps.findIndex((step) => step.id === stepId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= spec.steps.length) {
    return spec;
  }
  const steps = [...spec.steps];
  const [item] = steps.splice(index, 1);
  if (!item) {
    return spec;
  }
  steps.splice(nextIndex, 0, item);
  return clearStaleConditions({ ...spec, steps });
}

export function deleteStep(spec: FormSpec, stepId: string) {
  if (spec.steps.length <= 1) {
    return { error: "A form needs at least one step." };
  }
  return { spec: clearStaleConditions({ ...spec, steps: spec.steps.filter((step) => step.id !== stepId) }) };
}
