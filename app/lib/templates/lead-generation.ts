import type { FormTemplate } from "./types";

export const leadGeneration: FormTemplate = {
  slug: "lead-generation",
  name: "Lead generation",
  description: "Ask for a name, work email, company size, and the problem they want solved.",
  category: "Marketing",
  spec: {
    schemaVersion: 1,
    title: "Talk to us",
    description: "Tell us about your team and we will send a relevant next step.",
    submitLabel: "Get in touch",
    successMessage: "Thanks. A note is on the way.",
    appearance: { theme: "light", accent: "green", radius: "md", width: "md", submitWidth: "full" },
    steps: [
      {
        id: "lead",
        title: "Lead",
        fields: [
          { id: "name", type: "text", label: "Name", required: true },
          { id: "email", type: "email", label: "Work email", required: true },
          { id: "company", type: "text", label: "Company", required: true },
          {
            id: "company_size",
            type: "select",
            label: "Company size",
            required: true,
            options: [
              { value: "1_10", label: "1–10" },
              { value: "11_50", label: "11–50" },
              { value: "51_200", label: "51–200" },
              { value: "200_plus", label: "200+" },
            ],
          },
          { id: "problem", type: "textarea", label: "What problem are you solving?", required: true },
        ],
      },
    ],
  },
};
