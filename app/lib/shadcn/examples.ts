import type { FormSpec } from "../definitions";

export const multiStepExample: FormSpec = {
  schemaVersion: 1,
  title: "Project onboarding",
  description: "Three steps: who you are, what you need, and when you want to start.",
  submitLabel: "Submit onboarding",
  successMessage: "Onboarding received.",
  appearance: { theme: "dark", accent: "blue", radius: "md", width: "md", submitWidth: "auto" },
  steps: [
    {
      id: "contact",
      title: "Contact",
      fields: [
        { id: "name", type: "text", label: "Name", required: true, placeholder: "Ada Lovelace" },
        { id: "email", type: "email", label: "Email", required: true, placeholder: "ada@studio.com" },
      ],
    },
    {
      id: "project",
      title: "Project",
      fields: [
        { id: "company", type: "text", label: "Company", required: false },
        {
          id: "work_type",
          type: "select",
          label: "Type of work",
          required: true,
          options: [
            { value: "website", label: "Website" },
            { value: "product", label: "Product" },
            { value: "brand", label: "Brand" },
          ],
        },
        { id: "brief", type: "textarea", label: "What do you need?", required: true },
      ],
    },
    {
      id: "schedule",
      title: "Schedule",
      fields: [
        { id: "start_date", type: "date", label: "Preferred start", required: true },
        {
          id: "timeline",
          type: "radio",
          label: "Timeline",
          required: true,
          options: [
            { value: "asap", label: "As soon as possible" },
            { value: "this_quarter", label: "This quarter" },
            { value: "flexible", label: "Flexible" },
          ],
        },
      ],
    },
  ],
};

export const conditionalExample: FormSpec = {
  schemaVersion: 1,
  title: "Support request",
  description: "Choose a request type. Extra fields appear only when they apply.",
  submitLabel: "Send request",
  successMessage: "Request received.",
  appearance: { theme: "dark", accent: "violet", radius: "md", width: "md", submitWidth: "full" },
  steps: [
    {
      id: "request",
      title: "Request",
      fields: [
        { id: "name", type: "text", label: "Name", required: true },
        { id: "email", type: "email", label: "Email", required: true },
        {
          id: "topic",
          type: "radio",
          label: "What do you need?",
          required: true,
          options: [
            { value: "bug", label: "Report a bug" },
            { value: "feature", label: "Request a feature" },
            { value: "other", label: "Something else" },
          ],
        },
        {
          id: "severity",
          type: "select",
          label: "Severity",
          required: true,
          visibleWhen: { fieldId: "topic", equals: "bug" },
          options: [
            { value: "low", label: "Low" },
            { value: "high", label: "High" },
            { value: "blocking", label: "Blocking" },
          ],
        },
        {
          id: "use_case",
          type: "textarea",
          label: "What should this feature do?",
          required: true,
          visibleWhen: { fieldId: "topic", equals: "feature" },
        },
        { id: "details", type: "textarea", label: "Details", required: true },
      ],
    },
  ],
};
