import type { FormTemplate } from "./types";

export const projectRequest: FormTemplate = {
  slug: "project-request",
  name: "Project request",
  description: "Capture the work type, deadline, and a short brief for a new project.",
  category: "Business",
  spec: {
    schemaVersion: 1,
    title: "Project request",
    description: "Share enough context for a first estimate.",
    submitLabel: "Request project",
    successMessage: "Request received. We will follow up with next steps.",
    appearance: { theme: "dark", accent: "blue", radius: "md", width: "md", submitWidth: "auto" },
    steps: [
      {
        id: "overview",
        title: "Brief",
        fields: [
          { id: "name", type: "text", label: "Name", required: true },
          { id: "email", type: "email", label: "Email", required: true },
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
          { id: "deadline", type: "date", label: "Deadline", required: false },
          { id: "brief", type: "textarea", label: "Brief", required: true, placeholder: "What do you need built?" },
        ],
      },
    ],
  },
};
