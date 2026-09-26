import type { FormTemplate } from "./types";

export const rsvp: FormTemplate = {
  slug: "rsvp",
  name: "RSVP",
  description: "Ask if guests are coming and what they will eat.",
  category: "Events",
  spec: {
    schemaVersion: 1,
    title: "Event RSVP",
    description: "Let us know if you can make it.",
    submitLabel: "Send RSVP",
    successMessage: "RSVP saved. See you there.",
    appearance: { theme: "dark", accent: "rose", radius: "xl", width: "sm", submitWidth: "full" },
    steps: [
      {
        id: "rsvp",
        title: "RSVP",
        fields: [
          { id: "name", type: "text", label: "Name", required: true },
          { id: "email", type: "email", label: "Email", required: true },
          {
            id: "attending",
            type: "radio",
            label: "Will you attend?",
            required: true,
            options: [
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ],
          },
          {
            id: "meal",
            type: "select",
            label: "Meal preference",
            required: true,
            visibleWhen: { fieldId: "attending", equals: "yes" },
            options: [
              { value: "vegetarian", label: "Vegetarian" },
              { value: "chicken", label: "Chicken" },
              { value: "fish", label: "Fish" },
            ],
          },
        ],
      },
    ],
  },
};
