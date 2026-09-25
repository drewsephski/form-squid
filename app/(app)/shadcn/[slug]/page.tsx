import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { compileForm } from "@/app/lib/compiler";
import { pageMetadata } from "@/app/lib/seo";
import { getShadcnPage, shadcnPages } from "@/app/lib/shadcn/pages";
import { FormView } from "@/app/ui/form-view";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SeoPageView } from "@/app/ui/seo-page-view";
import { SourceTabs } from "@/app/ui/source-tabs";
import { UseTemplateButton } from "@/app/ui/use-template-button";

export function generateStaticParams() {
  return shadcnPages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = getShadcnPage(slug);
  if (!page) {
    return { title: "FormSquid" };
  }
  return pageMetadata({
    title: `${page.title} | FormSquid`,
    description: page.description,
    path: `/shadcn/${page.slug}`,
  });
}

export default async function ShadcnExamplePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getShadcnPage(slug);
  if (!page) {
    notFound();
  }

  const compiled = compileForm(page.spec, { submission: "callback" });
  const fields = page.spec.steps.flatMap((step) => step.fields.map((field) => ({ step: step.title, ...field })));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-4 py-8">
      <SeoPageView page={`/shadcn/${page.slug}`} shadcnSlug={page.slug} />
      <header className="space-y-3">
        <p className="text-xs tracking-wide text-muted-foreground uppercase">shadcn/ui</p>
        <h1 className="font-heading text-4xl font-medium tracking-tight">{page.title}</h1>
        <p className="max-w-2xl text-muted-foreground">{page.intro}</p>
      </header>

      <section className="space-y-3" aria-labelledby="live-preview">
        <h2 id="live-preview" className="text-sm font-medium">Live preview</h2>
        <div className="rounded-xl border bg-muted/30 p-6">
          <FormView spec={page.spec} preview />
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="customize">
        <h2 id="customize" className="text-sm font-medium">Customize with AI</h2>
        <p className="text-sm text-muted-foreground">Open this exact spec in FormSquid. Signed-in accounts go straight to the editor.</p>
        <UseTemplateButton spec={page.spec} label="Customize with AI" intent="customize" page={`/shadcn/${page.slug}`} shadcnSlug={page.slug} />
        {page.templateHref ? (
          <p className="text-sm text-muted-foreground">
            <Link href={page.templateHref} className="underline-offset-4 hover:underline">
              Prefer the template page?
            </Link>
          </p>
        ) : null}
      </section>

      <section className="space-y-3" aria-labelledby="source">
        <h2 id="source" className="text-sm font-medium">Code</h2>
        <p className="text-sm text-muted-foreground">
          Standalone source. <code>ExportedForm</code> calls <code>onSubmit</code> with the validated data.
        </p>
        <SourceTabs formSource={compiled.formSource} schemaSource={compiled.schemaSource} page={`/shadcn/${page.slug}`} shadcnSlug={page.slug} />
      </section>

      <section className="space-y-3" aria-labelledby="included">
        <h2 id="included" className="text-sm font-medium">What’s included</h2>
        <ul className="space-y-1 text-sm">
          {page.included.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="fields">
        <h2 id="fields" className="text-sm font-medium">Fields</h2>
        <ul className="space-y-2 text-sm">
          {fields.map((field) => (
            <li key={field.id}>
              {field.label}
              <span className="text-muted-foreground">
                {" "}
                · {field.type}
                {field.required ? " · required" : ""}
                {field.visibleWhen ? ` · shown when ${field.visibleWhen.fieldId} is ${field.visibleWhen.equals}` : ""}
                {page.spec.steps.length > 1 ? ` · ${field.step}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3" aria-labelledby="how-to-customize">
        <h2 id="how-to-customize" className="text-sm font-medium">How to customize</h2>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {page.customize.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>

      <section className="space-y-4" aria-labelledby="faq">
        <h2 id="faq" className="text-sm font-medium">FAQ</h2>
        <Accordion>
          {page.faq.map((item) => (
            <AccordionItem key={item.question} value={item.question}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="space-y-3" aria-labelledby="related">
        <h2 id="related" className="text-sm font-medium">Related forms</h2>
        <ul className="space-y-2 text-sm">
          {page.related.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="underline-offset-4 hover:underline">
                {link.label}
              </Link>
              <span className="text-muted-foreground"> — {link.note}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
