import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pageMetadata } from "@/app/lib/seo";
import { getTemplate, templates } from "@/app/lib/templates";
import { templateSeo } from "@/app/lib/templates/seo";
import { FormView } from "@/app/ui/form-view";
import { SeoPageView } from "@/app/ui/seo-page-view";
import { UseTemplateButton } from "@/app/ui/use-template-button";

export function generateStaticParams() {
  return templates.map((template) => ({ slug: template.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const template = getTemplate(slug);
  const seo = template ? templateSeo[template.slug] : undefined;
  if (!template || !seo) {
    return { title: "Form Template | FormSquid" };
  }
  return pageMetadata({
    title: seo.title,
    description: seo.description,
    path: `/templates/${template.slug}`,
  });
}

export default async function TemplatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const template = getTemplate(slug);
  if (!template) {
    notFound();
  }
  const fields = template.spec.steps.flatMap((step) => step.fields);
  const seo = templateSeo[template.slug];

  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 gap-10 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <SeoPageView page={`/templates/${template.slug}`} templateSlug={template.slug} />
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs tracking-wide text-muted-foreground uppercase">{template.category}</p>
          <h1 className="font-heading text-4xl font-medium tracking-tight">{template.name}</h1>
          <p className="max-w-xl text-muted-foreground">{template.description}</p>
        </div>
        <div className="rounded-xl border bg-muted/30 p-6">
          <FormView spec={template.spec} preview />
        </div>
        <UseTemplateButton spec={template.spec} page={`/templates/${template.slug}`} templateSlug={template.slug} />
      </div>
      <aside className="space-y-4">
        <h2 className="text-sm font-medium">Fields</h2>
        <ul className="space-y-2 text-sm">
          {fields.map((field) => (
            <li key={field.id}>• {field.label}</li>
          ))}
        </ul>
        <Link href="/templates" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          All templates
        </Link>
        {seo ? (
          <p className="text-sm">
            <Link href={seo.reactHref} className="underline-offset-4 hover:underline">
              {seo.reactLabel}
            </Link>
          </p>
        ) : null}
      </aside>
    </main>
  );
}
