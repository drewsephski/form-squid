import type { FormTemplate } from "./types";

export const clientIntake: FormTemplate = {
  slug: "client-intake",
  name: "Client intake",
  description: "Project goals, timeline, budget, and contact details.",
  category: "Business",
  spec: {
    schemaVersion: 1,
    title: "Client intake",
    description: "Tell us about the project so we can prepare a useful first conversation.",
    submitLabel: "Send intake",
    successMessage: "Thanks. We received your intake and will reply shortly.",
    appearance: { theme: "dark", accent: "violet", radius: "md", width: "md", submitWidth: "full" },
    steps: [
      {
        id: "contact",
        title: "Contact",
        fields: [
          { id: "name", type: "text", label: "Name", required: true, placeholder: "Ada Lovelace" },
          { id: "email", type: "email", label: "Email", required: true, placeholder: "ada@studio.com" },
          { id: "company", type: "text", label: "Company", required: false, placeholder: "Analytical Engines" },
        ],
      },
      {
        id: "project",
        title: "Project",
        fields: [
          {
            id: "budget",
            type: "select",
            label: "Budget",
            required: true,
            options: [
              { value: "under_5k", label: "Under $5,000" },
              { value: "5k_15k", label: "$5,000–$15,000" },
              { value: "15k_50k", label: "$15,000–$50,000" },
              { value: "over_50k", label: "Over $50,000" },
            ],
          },
          {
            id: "timeline",
            type: "select",
            label: "Timeline",
            required: true,
            options: [
              { value: "asap", label: "As soon as possible" },
              { value: "this_quarter", label: "This quarter" },
              { value: "flexible", label: "Flexible" },
            ],
          },
          { id: "website", type: "text", label: "Current website", required: false, placeholder: "https://" },
          { id: "goals", type: "textarea", label: "Project goals", required: true, placeholder: "What should this work accomplish?" },
        ],
      },
    ],
  },
};
