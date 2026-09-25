import { clientIntake } from "./client-intake";
import { contact } from "./contact";
import { feedback } from "./feedback";
import { jobApplication } from "./job-application";
import { leadGeneration } from "./lead-generation";
import { projectRequest } from "./project-request";
import { rsvp } from "./rsvp";
import { waitlist } from "./waitlist";
import type { FormTemplate } from "./types";

export const templates: FormTemplate[] = [
  clientIntake,
  jobApplication,
  waitlist,
  contact,
  rsvp,
  feedback,
  projectRequest,
  leadGeneration,
];

export function getTemplate(slug: string) {
  return templates.find((template) => template.slug === slug) ?? null;
}
