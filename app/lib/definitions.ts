import { z } from "zod";

export const fieldIdSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,63}$/, "Use a lowercase id starting with a letter.");

export const fieldTypes = [
  "text",
  "email",
  "textarea",
  "number",
  "select",
  "radio",
  "checkbox",
  "date",
  "file",
] as const;

export type FieldType = (typeof fieldTypes)[number];

const plainText = (max: number) => z.string().trim().min(1).max(max);

const optionalPlainText = (max: number) => z.string().max(max);

export const optionSchema = z.object({
  value: plainText(200),
  label: plainText(200),
});

export const visibleWhenSchema = z.object({
  fieldId: fieldIdSchema,
  equals: z.string().max(200),
});

export const fileMaxFilesSchema = z.union([z.literal(1), z.literal(5)]);

export const fieldSchema = z.object({
  id: fieldIdSchema,
  type: z.enum(fieldTypes),
  label: plainText(200),
  description: optionalPlainText(1000).optional(),
  placeholder: optionalPlainText(1000).optional(),
  required: z.boolean(),
  options: z.array(optionSchema).max(20).optional(),
  visibleWhen: visibleWhenSchema.optional(),
  maxFiles: fileMaxFilesSchema.optional(),
  maxFileSizeMb: z.number().int().positive().max(25).optional(),
  accept: z.array(plainText(100)).max(20).optional(),
});

export const stepSchema = z.object({
  id: fieldIdSchema,
  title: plainText(200),
  fields: z.array(fieldSchema).min(1).max(40),
});

export const appearanceSchema = z.object({
  theme: z.enum(["light", "dark"]),
  accent: z.enum(["neutral", "blue", "violet", "green", "orange", "rose"]),
  radius: z.enum(["none", "md", "xl"]),
  width: z.enum(["sm", "md", "lg"]),
  submitWidth: z.enum(["auto", "full"]),
});

export const formSpecSchema = z
  .object({
    schemaVersion: z.literal(1),
    title: plainText(200),
    description: optionalPlainText(1000).optional(),
    submitLabel: plainText(200),
    successMessage: plainText(1000),
    steps: z.array(stepSchema).min(1).max(5),
    appearance: appearanceSchema.optional(),
  })
  .superRefine((spec, context) => {
    const seen = new Set<string>();
    const ordered = spec.steps.flatMap((step) => step.fields);

    if (ordered.length > 40) {
      context.addIssue({
        code: "custom",
        message: "A form can have at most 40 fields.",
        path: ["steps"],
      });
    }

    for (const step of spec.steps) {
      if (seen.has(step.id)) {
        context.addIssue({
          code: "custom",
          message: "Ids must be unique.",
          path: ["steps"],
        });
      }
      seen.add(step.id);
    }

    ordered.forEach((field, index) => {
      if (seen.has(field.id)) {
        context.addIssue({
          code: "custom",
          message: "Ids must be unique.",
          path: ["steps"],
        });
      }
      seen.add(field.id);

      const choice = field.type === "select" || field.type === "radio";
      if (choice) {
        if (!field.options || field.options.length === 0) {
          context.addIssue({
            code: "custom",
            message: "Add at least one option.",
            path: ["steps"],
          });
        } else {
          const values = new Set<string>();
          for (const option of field.options) {
            if (values.has(option.value)) {
              context.addIssue({
                code: "custom",
                message: "Option values must be unique.",
                path: ["steps"],
              });
            }
            values.add(option.value);
          }
        }
      } else if (field.options) {
        context.addIssue({
          code: "custom",
          message: "Only select and radio fields have options.",
          path: ["steps"],
        });
      }

      if (field.type === "file") {
        if (field.accept && field.accept.length === 0) {
          context.addIssue({
            code: "custom",
            message: "File accept list cannot be empty.",
            path: ["steps"],
          });
        }
      } else if (field.maxFiles !== undefined || field.maxFileSizeMb !== undefined || field.accept !== undefined) {
        context.addIssue({
          code: "custom",
          message: "Only file fields have upload settings.",
          path: ["steps"],
        });
      }

      if (!field.visibleWhen) {
        return;
      }

      const earlier = ordered.slice(0, index);
      const parent = earlier.find((item) => item.id === field.visibleWhen?.fieldId);
      if (!parent) {
        context.addIssue({
          code: "custom",
          message: "A condition can only reference an earlier field.",
          path: ["steps"],
        });
        return;
      }

      if (parent.type === "checkbox" && !["true", "false"].includes(field.visibleWhen.equals)) {
        context.addIssue({
          code: "custom",
          message: "Checkbox conditions must equal true or false.",
          path: ["steps"],
        });
      }

      if (
        (parent.type === "select" || parent.type === "radio") &&
        !parent.options?.some((option) => option.value === field.visibleWhen?.equals)
      ) {
        context.addIssue({
          code: "custom",
          message: "Condition must match an option value.",
          path: ["steps"],
        });
      }

      if (parent.type === "number") {
        const parsed = Number(field.visibleWhen.equals);
        if (!Number.isFinite(parsed) || JSON.stringify(parsed) !== field.visibleWhen.equals) {
          context.addIssue({
            code: "custom",
            message: "Number conditions must use a canonical decimal string.",
            path: ["steps"],
          });
        }
      }
    });
  });

export type FormSpec = z.infer<typeof formSpecSchema>;
export type FormField = z.infer<typeof fieldSchema>;

const aiOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});

const aiVisibleWhenSchema = z.object({
  fieldId: z.string(),
  equals: z.string(),
});

export const aiFieldSchema = z.object({
  id: z.string(),
  type: z.enum(fieldTypes),
  label: z.string(),
  description: z.string().nullable(),
  placeholder: z.string().nullable(),
  required: z.boolean(),
  options: z.array(aiOptionSchema).nullable(),
  visibleWhen: aiVisibleWhenSchema.nullable(),
  maxFiles: z.union([z.literal(1), z.literal(5), z.null()]).optional(),
  maxFileSizeMb: z.number().nullable().optional(),
  accept: z.array(z.string()).nullable().optional(),
});

export const aiFormSpecSchema = z.object({
  schemaVersion: z.literal(1),
  title: z.string(),
  description: z.string().nullable(),
  submitLabel: z.string(),
  successMessage: z.string(),
  steps: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        fields: z.array(aiFieldSchema),
      }),
    )
    .min(1)
    .max(5),
});

export type AiFormSpec = z.infer<typeof aiFormSpecSchema>;

export const submissionFileRefSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  contentType: z.string().min(1).max(200),
  size: z.number().int().nonnegative(),
});

export type SubmissionFileRef = z.infer<typeof submissionFileRefSchema>;

export type SubmissionValue =
  | string
  | number
  | boolean
  | SubmissionFileRef
  | SubmissionFileRef[]
  | string[];
export type SubmissionData = Record<string, SubmissionValue>;

/** Client submits opaque upload ids; server normalizes to SubmissionFileRef. */
export type SubmissionFileInput = string | string[];

export type SubmissionError = {
  path: string;
  message: string;
};

export type SubmissionResult =
  | { ok: true; data: SubmissionData }
  | { ok: false; errors: SubmissionError[] };

export const pendingSpecKey = "formsquid:pending-spec";
export const honeypotField = "_gotcha";
export const maxSubmissionBytes = 32 * 1024;
export const maxSubmissionsPerDay = 1000;
export const maxSubmissionAttemptsPerMinute = 20;
export const maxPayloadStringLength = 5000;
