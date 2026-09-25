import { contact } from "../templates/contact";
import { clientIntake } from "../templates/client-intake";
import { feedback } from "../templates/feedback";
import { jobApplication } from "../templates/job-application";
import { waitlist } from "../templates/waitlist";
import type { FormSpec } from "../definitions";
import { conditionalExample, multiStepExample } from "./examples";

export interface ShadcnLink {
  href: string;
  label: string;
  note: string;
}

export interface ShadcnPage {
  slug: string;
  title: string;
  description: string;
  intro: string;
  spec: FormSpec;
  templateHref?: string;
  included: string[];
  customize: string[];
  faq: Array<{ question: string; answer: string }>;
  related: ShadcnLink[];
}

const sharedIncluded = ["React Hook Form", "Zod validation", "shadcn/ui", "Responsive styling"];

export const shadcnPages: ShadcnPage[] = [
  {
    slug: "form-builder",
    title: "Shadcn Form Builder",
    description:
      "Build a shadcn/ui form in the browser. Preview it, copy a React Hook Form and Zod component, then customize the fields with AI or host submissions.",
    intro:
      "Describe the form, inspect a working preview, and copy source that submits through an onSubmit callback. When you want an inbox, the same spec becomes a hosted FormSquid form.",
    spec: contact.spec,
    templateHref: "/templates/contact",
    included: sharedIncluded,
    customize: [
      "Change labels, placeholders, and required fields in the editor.",
      "Ask FormSquid to add a step, a select, or a condition without rewriting the component.",
      "Publish when you want a public URL and a submissions inbox. The hosted export posts to your form endpoint.",
    ],
    faq: [
      {
        question: "Does the copied component post to FormSquid?",
        answer:
          "No. The source on this page calls onSubmit with the validated data. You wire that callback to your own API. Hosting is a separate step after you customize the spec.",
      },
      {
        question: "Which packages does the component use?",
        answer: "React Hook Form, Zod, and the shadcn/ui form, input, button, and related field components.",
      },
      {
        question: "Can I start from a template instead?",
        answer: "Yes. The template pages are written for the business use case. These pages are the React implementation of the same forms.",
      },
    ],
    related: [
      { href: "/shadcn/contact-form", label: "Contact form", note: "Name, email, and message" },
      { href: "/shadcn/multi-step-form", label: "Multi-step form", note: "Next and back across steps" },
      { href: "/shadcn/conditional-form", label: "Conditional form", note: "Fields that show when a choice matches" },
      { href: "/templates", label: "Templates", note: "Preview a form and publish it" },
    ],
  },
  {
    slug: "client-intake-form",
    title: "Shadcn Client Intake Form",
    description:
      "A shadcn/ui client intake form with React Hook Form and Zod. Preview the two-step flow, copy the component, and customize budget, timeline, and project goals.",
    intro:
      "Two steps collect contact details, then budget, timeline, website, and project goals. Copy the component and schema, or open the same spec in FormSquid and edit it with AI.",
    spec: clientIntake.spec,
    templateHref: "/templates/client-intake",
    included: [...sharedIncluded, "Two steps with next and back"],
    customize: [
      "Add a service-type select or a file-free notes field on the project step.",
      "Ask FormSquid to show budget follow-ups only for a chosen range.",
      "Publish to collect intakes in an inbox instead of handling onSubmit yourself.",
    ],
    faq: [
      {
        question: "How is this different from the client intake template?",
        answer:
          "The template page is for agencies who want a ready form to publish. This page is the React and Zod implementation of that same spec.",
      },
      {
        question: "Does step two validate before the form submits?",
        answer: "Next validates the current step. Submit validates the full payload with the generated Zod schema.",
      },
      {
        question: "Can I host the responses?",
        answer: "Customize with AI, then publish. FormSquid stores submissions for that form and can export the hosted version of the component.",
      },
    ],
    related: [
      { href: "/templates/client-intake", label: "Client intake template", note: "The publishable version of this form" },
      { href: "/shadcn/conditional-form", label: "Conditional form", note: "Show fields after a choice" },
      { href: "/shadcn/multi-step-form", label: "Multi-step form", note: "How steps are compiled" },
      { href: "/shadcn/contact-form", label: "Contact form", note: "A shorter single-step form" },
    ],
  },
  {
    slug: "job-application-form",
    title: "Shadcn Job Application Form",
    description:
      "A shadcn/ui job application form with React Hook Form and Zod. Collect profile links, experience level, a start date, and a note of interest.",
    intro:
      "The first step asks for name, email, LinkedIn, and GitHub. The second asks for experience level, availability, and why the candidate is interested.",
    spec: jobApplication.spec,
    templateHref: "/templates/job-application",
    included: [...sharedIncluded, "Two steps", "Radio, date, and link fields"],
    customize: [
      "Add a role select or a work-authorization checkbox.",
      "Ask FormSquid to require GitHub only for engineering roles.",
      "Publish when you want applications in an inbox rather than your own endpoint.",
    ],
    faq: [
      {
        question: "Are LinkedIn and GitHub required?",
        answer: "They are optional in this spec. Name, email, experience level, start date, and the interest note are required.",
      },
      {
        question: "Can I turn this into a hosted application form?",
        answer: "Yes. Customize with AI creates your form from this spec. Publish when you want a public link and stored submissions.",
      },
    ],
    related: [
      { href: "/templates/job-application", label: "Job application template", note: "Preview and publish the same form" },
      { href: "/shadcn/multi-step-form", label: "Multi-step form", note: "Step navigation in the compiler" },
      { href: "/shadcn/conditional-form", label: "Conditional form", note: "Reveal fields from an earlier answer" },
      { href: "/shadcn/contact-form", label: "Contact form", note: "A single-step message form" },
    ],
  },
  {
    slug: "waitlist-form",
    title: "Shadcn Waitlist Form",
    description:
      "A shadcn/ui waitlist form with React Hook Form and Zod. Collect a name, email, company, and the use case someone wants access for.",
    intro:
      "One step is enough for a waitlist. The component validates email and the use-case note, then hands the payload to onSubmit.",
    spec: waitlist.spec,
    templateHref: "/templates/waitlist",
    included: sharedIncluded,
    customize: [
      "Add a plan or company-size select if you need to segment the list.",
      "Ask FormSquid to split company details onto a second step.",
      "Publish to store signups without standing up your own endpoint.",
    ],
    faq: [
      {
        question: "Where do submissions go?",
        answer: "This source calls onSubmit. Host the form in FormSquid if you want the responses stored for you.",
      },
      {
        question: "Can I add a referral field?",
        answer: "Yes. Open the spec with Customize with AI and ask for the field. The preview and schema update together.",
      },
    ],
    related: [
      { href: "/templates/waitlist", label: "Waitlist template", note: "The same form, ready to publish" },
      { href: "/shadcn/contact-form", label: "Contact form", note: "Name, email, and a message" },
      { href: "/shadcn/feedback-form", label: "Feedback form", note: "A short product survey" },
      { href: "/shadcn/form-builder", label: "Form builder", note: "Generate a different form from a prompt" },
    ],
  },
  {
    slug: "contact-form",
    title: "Shadcn Contact Form",
    description:
      "A shadcn/ui contact form with React Hook Form and Zod. Preview name, email, and message fields, then copy the component or customize it.",
    intro:
      "A single step with name, email, and message. The Zod schema checks the email and requires the message before onSubmit runs.",
    spec: contact.spec,
    templateHref: "/templates/contact",
    included: sharedIncluded,
    customize: [
      "Add a subject select or a phone field.",
      "Ask FormSquid to require a company name for sales inquiries.",
      "Publish if you want messages in an inbox instead of your own handler.",
    ],
    faq: [
      {
        question: "Is this a drop-in shadcn block?",
        answer:
          "Copy schema.ts and form.tsx into a project that already has the shadcn form components. Pass onSubmit to ExportedForm.",
      },
      {
        question: "How do I add conditional fields?",
        answer: "See the conditional form. A later field can render only when an earlier radio or select matches a value.",
      },
    ],
    related: [
      { href: "/templates/contact", label: "Contact template", note: "Publish this form without writing the handler" },
      { href: "/shadcn/feedback-form", label: "Feedback form", note: "Satisfaction plus two notes" },
      { href: "/shadcn/client-intake-form", label: "Client intake form", note: "A longer two-step brief" },
      { href: "/shadcn/form-builder", label: "Form builder", note: "Generate the fields from a prompt" },
    ],
  },
  {
    slug: "feedback-form",
    title: "Shadcn Feedback Form",
    description:
      "A shadcn/ui feedback form with React Hook Form and Zod. Collect a satisfaction rating and optional notes about what worked and what did not.",
    intro:
      "A radio group records satisfaction. Two text areas collect what went well and what could be better. Only the rating is required.",
    spec: feedback.spec,
    templateHref: "/templates/feedback",
    included: [...sharedIncluded, "Radio group"],
    customize: [
      "Add a product or visit-date field if you need to group responses.",
      "Ask FormSquid to require the improvement note when satisfaction is low.",
      "Publish to read feedback in the submissions inbox.",
    ],
    faq: [
      {
        question: "Are the written answers required?",
        answer: "No. Satisfaction is required. The two notes are optional so a short rating can still submit.",
      },
      {
        question: "Can low scores reveal a follow-up?",
        answer: "Yes. The conditional form shows the pattern. Ask FormSquid to show a follow-up when the rating matches a value.",
      },
    ],
    related: [
      { href: "/templates/feedback", label: "Feedback template", note: "Preview and publish the survey" },
      { href: "/shadcn/conditional-form", label: "Conditional form", note: "Follow-up fields from an answer" },
      { href: "/shadcn/contact-form", label: "Contact form", note: "A message instead of a rating" },
      { href: "/shadcn/waitlist-form", label: "Waitlist form", note: "Collect interest before launch" },
    ],
  },
  {
    slug: "multi-step-form",
    title: "Shadcn Multi-Step Form",
    description:
      "A shadcn/ui multi-step form with React Hook Form and Zod. Preview next and back, copy the step schemas, and customize the flow with AI.",
    intro:
      "This example uses three steps: contact, project, and schedule. Next checks the current step. Submit checks the whole form. Empty later steps stay out of the way until the person reaches them.",
    spec: multiStepExample,
    included: [...sharedIncluded, "Three steps", "Per-step Zod schemas"],
    customize: [
      "Rename steps or move a field to an earlier step.",
      "Ask FormSquid to add a review step that only confirms, or to collapse this back to one step.",
      "Publish if you want the answers stored instead of handled in onSubmit.",
    ],
    faq: [
      {
        question: "Does each step have its own schema?",
        answer: "Yes. The generated schema file exports stepSchemas keyed by step id, plus a submissionSchema for the final submit.",
      },
      {
        question: "What happens if someone goes back?",
        answer: "Back returns to the previous step and keeps the values already entered in the form state.",
      },
      {
        question: "Where is a real multi-step template?",
        answer: "Client intake and the job application are two-step forms aimed at a specific job. This page is the pattern itself.",
      },
    ],
    related: [
      { href: "/shadcn/client-intake-form", label: "Client intake form", note: "A two-step intake" },
      { href: "/shadcn/job-application-form", label: "Job application form", note: "Profile, then experience" },
      { href: "/shadcn/conditional-form", label: "Conditional form", note: "Fields inside a step" },
      { href: "/shadcn/form-builder", label: "Form builder", note: "Generate a different step flow" },
    ],
  },
  {
    slug: "conditional-form",
    title: "Shadcn Conditional Form",
    description:
      "A shadcn/ui conditional form with React Hook Form and Zod. Show severity for bugs and a use-case field for feature requests, then copy the component.",
    intro:
      "A radio chooses bug, feature, or something else. Severity appears only for bugs. The feature note appears only for feature requests. Hidden required fields are not part of the payload until they are visible.",
    spec: conditionalExample,
    included: [...sharedIncluded, "Conditional fields"],
    customize: [
      "Point a condition at an earlier select, radio, checkbox, or number.",
      "Ask FormSquid to add another branch, or to require details only for blocking bugs.",
      "Publish when you want the requests stored with the same visibility rules.",
    ],
    faq: [
      {
        question: "Which fields can control visibility?",
        answer: "A condition references an earlier select, radio, checkbox, or number field and compares it to one value.",
      },
      {
        question: "Is a hidden required field still required?",
        answer: "No. Validation skips a field while its condition is false, including when that field is marked required.",
      },
      {
        question: "Is there a template that already uses this?",
        answer: "The RSVP template asks for a meal only when the guest is attending. This page shows the same mechanism on a support form.",
      },
    ],
    related: [
      { href: "/templates/rsvp", label: "RSVP template", note: "A meal field when the guest is coming" },
      { href: "/shadcn/client-intake-form", label: "Client intake form", note: "Add conditions to a longer form" },
      { href: "/shadcn/multi-step-form", label: "Multi-step form", note: "Split questions across steps" },
      { href: "/shadcn/feedback-form", label: "Feedback form", note: "A rating that can grow a follow-up" },
    ],
  },
];

export function getShadcnPage(slug: string) {
  return shadcnPages.find((page) => page.slug === slug) ?? null;
}
