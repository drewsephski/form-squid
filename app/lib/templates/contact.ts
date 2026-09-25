import type { FormTemplate } from "./types";

export const contact: FormTemplate = {
  slug: "contact",
  name: "Contact",
  description: "A short contact form with name, email, and a message.",
  category: "General",
  spec: {
    schemaVersion: 1,
    title: "Contact",
    description: "Send a note and we will get back to you.",
    submitLabel: "Send message",
    successMessage: "Message sent. We will reply by email.",
    appearance: { theme: "dark", accent: "blue", radius: "md", width: "sm", submitWidth: "full" },
    steps: [
      {
        id: "details",
        title: "Message",
        fields: [
          { id: "name", type: "text", label: "Name", required: true },
          { id: "email", type: "email", label: "Email", required: true },
          { id: "message", type: "textarea", label: "Message", required: true, placeholder: "How can we help?" },
        ],
      },
    ],
  },
};
