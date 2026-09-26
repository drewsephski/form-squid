import type { FormTemplate } from "./types";

export const feedback: FormTemplate = {
  slug: "feedback",
  name: "Feedback",
  description: "Collect satisfaction scores, what went well, and ideas for what to improve on.",
  category: "Product",
  spec: {
    schemaVersion: 1,
    title: "Feedback",
    description: "Tell us how it went.",
    submitLabel: "Send feedback",
    successMessage: "Thanks for the feedback.",
    appearance: { theme: "dark", accent: "orange", radius: "md", width: "sm", submitWidth: "full" },
    steps: [
      {
        id: "survey",
        title: "Survey",
        fields: [
          {
            id: "satisfaction",
            type: "radio",
            label: "How satisfied are you?",
            required: true,
            options: [
              { value: "1", label: "Not satisfied" },
              { value: "2", label: "Okay" },
              { value: "3", label: "Very satisfied" },
            ],
          },
          { id: "went_well", type: "textarea", label: "What went well?", required: false },
          { id: "improve", type: "textarea", label: "What could be better?", required: false },
        ],
      },
    ],
  },
};
