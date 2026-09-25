import Link from "next/link";
import { templates } from "@/app/lib/templates";
import { FormMiniPreview } from "@/app/ui/form-mini-preview";

const featured = ["client-intake", "job-application", "waitlist", "contact", "rsvp", "feedback"];

export function TemplateSection() {
  const cards = featured.flatMap((slug) => {
    const template = templates.find((item) => item.slug === slug);
    return template ? [template] : [];
  });

  return (
    <section className="space-y-4" aria-labelledby="start-from-template">
      <div className="space-y-1 text-center">
        <h2 id="start-from-template" className="font-heading text-2xl font-medium tracking-tight">
          Start from a template
        </h2>
        <p className="text-sm text-muted-foreground">Open a working form, then save it to customize.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {cards.map((template) => (
          <li key={template.slug}>
            <Link href={`/templates/${template.slug}`} className="block space-y-3 rounded-2xl border p-3 transition-colors hover:bg-muted/40">
              <FormMiniPreview spec={template.spec} previewId={template.slug} />
              <span className="block text-sm font-medium">{template.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
