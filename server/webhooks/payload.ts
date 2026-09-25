import type { FormSpec, SubmissionData } from "../../app/lib/definitions";

export const submissionCreatedEvent = "submission.created" as const;
export const submissionTestEvent = "submission.test" as const;

export type WebhookEvent = typeof submissionCreatedEvent | typeof submissionTestEvent;

export type WebhookFormRef = {
  id: string;
  slug: string;
  title: string;
  version: number;
};

export type WebhookSubmissionRef = {
  id: string;
  createdAt: string;
  data: SubmissionData;
};

export type WebhookPayload = {
  id: string;
  event: WebhookEvent;
  createdAt: string;
  form: WebhookFormRef;
  submission: WebhookSubmissionRef;
};

export type SubmissionDispatch = {
  submissionId: string;
  formId: string;
  formSlug: string;
  formTitle: string;
  version: number;
  createdAt: string;
  data: SubmissionData;
};

export function buildWebhookPayload(input: {
  deliveryId: string;
  event: WebhookEvent;
  createdAt: string;
  form: WebhookFormRef;
  submission: WebhookSubmissionRef;
}): WebhookPayload {
  return {
    id: input.deliveryId,
    event: input.event,
    createdAt: input.createdAt,
    form: {
      id: input.form.id,
      slug: input.form.slug,
      title: input.form.title,
      version: input.form.version,
    },
    submission: {
      id: input.submission.id,
      createdAt: input.submission.createdAt,
      data: input.submission.data,
    },
  };
}

export function sampleSubmissionData(spec: FormSpec): SubmissionData {
  const data: SubmissionData = {};
  for (const field of spec.steps.flatMap((step) => step.fields)) {
    switch (field.type) {
      case "email":
        data[field.id] = "person@example.com";
        break;
      case "number":
        data[field.id] = 1;
        break;
      case "checkbox":
        data[field.id] = true;
        break;
      case "date":
        data[field.id] = "2026-01-15";
        break;
      case "select":
      case "radio":
        data[field.id] = field.options?.[0]?.value ?? "example";
        break;
      case "textarea":
        data[field.id] = "Example response";
        break;
      default:
        data[field.id] = field.label.toLowerCase().includes("name") ? "Example response" : "Example response";
        break;
    }
  }
  return data;
}
