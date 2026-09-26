import type { FormTemplate } from "./types";

export const jobApplication: FormTemplate = {
  slug: "job-application",
  name: "Job application",
  description: "Collect applicant details, portfolio links, experience, and notes of interest.",
  category: "Hiring",
  spec: {
    schemaVersion: 1,
    title: "Job application",
    description: "Apply for the software engineering role.",
    submitLabel: "Submit application",
    successMessage: "Application received. We will be in touch.",
    appearance: { theme: "light", accent: "neutral", radius: "md", width: "md", submitWidth: "auto" },
    steps: [
      {
        id: "profile",
        title: "Profile",
        fields: [
          { id: "name", type: "text", label: "Name", required: true },
          { id: "email", type: "email", label: "Email", required: true },
          { id: "linkedin", type: "text", label: "LinkedIn", required: false, placeholder: "https://linkedin.com/in/" },
          { id: "github", type: "text", label: "GitHub", required: false, placeholder: "https://github.com/" },
        ],
      },
      {
        id: "experience",
        title: "Experience",
        fields: [
          {
            id: "level",
            type: "radio",
            label: "Experience level",
            required: true,
            options: [
              { value: "junior", label: "Junior" },
              { value: "mid", label: "Mid" },
              { value: "senior", label: "Senior" },
            ],
          },
          { id: "start_date", type: "date", label: "Available from", required: true },
          { id: "interest", type: "textarea", label: "Why are you interested?", required: true },
        ],
      },
    ],
  },
};
