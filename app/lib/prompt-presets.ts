export const promptPresets = [
  {
    label: "Client intake",
    prompt:
      "Create a client intake form for a web design agency. Ask for name, email, company, budget, current website, timeline, and project goals.",
  },
  {
    label: "Job application",
    prompt:
      "Create a software engineering job application with name, email, LinkedIn, GitHub, experience level, availability, and a short “why are you interested?” response.",
  },
  {
    label: "Waitlist",
    prompt: "Create a product waitlist form with name, email, company, and what they want to use the product for.",
  },
  {
    label: "Contact form",
    prompt: "Create a contact form with name, email, and a message.",
  },
  {
    label: "Event RSVP",
    prompt: "Create an event RSVP with name, email, whether they are attending, and a meal preference.",
  },
  {
    label: "Feedback survey",
    prompt: "Create a short feedback survey with a satisfaction rating, what went well, and what could be better.",
  },
  {
    label: "Quote request",
    prompt: "Create a quote request form with name, email, company, project type, budget, and a short description of the work.",
  },
  {
    label: "Booking request",
    prompt: "Create a booking request form with name, email, phone, preferred date, preferred time, and the reason for the visit.",
  },
] as const;
