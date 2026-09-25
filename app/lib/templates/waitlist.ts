import type { FormTemplate } from "./types";

export const waitlist: FormTemplate = {
  slug: "waitlist",
  name: "Waitlist",
  description: "Collect a name, email, company, and what someone wants to use the product for.",
  category: "Product",
  spec: {
    schemaVersion: 1,
    title: "Join the waitlist",
    description: "Be first to hear when we open access.",
    submitLabel: "Join waitlist",
    successMessage: "You are on the list.",
    appearance: { theme: "dark", accent: "green", radius: "xl", width: "sm", submitWidth: "full" },
    steps: [
      {
        id: "signup",
        title: "Signup",
        fields: [
          { id: "name", type: "text", label: "Name", required: true },
          { id: "email", type: "email", label: "Email", required: true },
          { id: "company", type: "text", label: "Company", required: false },
          { id: "use_case", type: "textarea", label: "What will you use it for?", required: true },
        ],
      },
    ],
  },
};
