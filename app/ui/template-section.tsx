import { templates } from "@/app/lib/templates";
import { TemplateCard } from "@/app/ui/template-card";

const featured = ["client-intake", "job-application", "waitlist", "contact", "rsvp", "feedback"];

export function TemplateSection() {
  const cards = featured.flatMap((slug) => {
    const template = templates.find((item) => item.slug === slug);
    return template ? [template] : [];
  });

  return (
    <section className="space-y-4" aria-labelledby="start-from-template">
      <div className="space-y-1 sm:text-center">
        <h2 id="start-from-template" className="font-heading text-2xl font-medium tracking-tight">
          Start from a template
        </h2>
        <p className="text-sm text-muted-foreground">Open a working form, then save it to customize.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {cards.map((template) => (
          <li key={template.slug}>
            <TemplateCard template={template} headingLevel={3} />
          </li>
        ))}
      </ul>
    </section>
  );
}
