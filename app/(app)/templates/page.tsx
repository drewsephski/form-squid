import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/app/lib/seo";
import { templates } from "@/app/lib/templates";
import { TemplateCard } from "@/app/ui/template-card";
import { SeoPageView } from "@/app/ui/seo-page-view";

export const metadata: Metadata = pageMetadata({
  title: "Form Templates | FormSquid",
  description:
    "Free form templates you can preview and publish. Start from client intake, job applications, waitlists, contact, RSVP, and feedback.",
  path: "/templates",
});

export default function TemplatesPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">
      <SeoPageView page="/templates" />
      <div className="mb-6 space-y-2 sm:mb-8">
        <h1 className="font-heading text-3xl font-medium tracking-tight sm:text-4xl">Templates</h1>
        <p className="max-w-xl text-muted-foreground">Working forms you can preview, save, and customize.</p>
        <p className="text-sm text-muted-foreground">
          <Link href="/shadcn/form-builder" className="underline-offset-4 hover:underline">
            Looking for the React source?
          </Link>
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {templates.map((template) => (
          <li key={template.slug}>
            <TemplateCard template={template} />
          </li>
        ))}
      </ul>
    </main>
  );
}
