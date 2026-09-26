import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/app/lib/seo";
import { templates } from "@/app/lib/templates";
import { FormMiniPreview } from "@/app/ui/form-mini-preview";
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
      <div className="mb-8 space-y-2">
        <h1 className="font-heading text-4xl font-medium tracking-tight">Templates</h1>
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
            <Link href={`/templates/${template.slug}`} className="block space-y-4 rounded-2xl border p-4 transition-colors hover:bg-muted/40">
              <FormMiniPreview spec={template.spec} previewId={template.slug} />
              <div className="space-y-1">
                <p className="text-xs tracking-wide text-muted-foreground uppercase">{template.category}</p>
                <h2 className="font-medium">{template.name}</h2>
                <p className="truncate text-sm text-muted-foreground">{template.description}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
