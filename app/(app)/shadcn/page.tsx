import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/app/lib/seo";
import { shadcnPages } from "@/app/lib/shadcn/pages";
import { SeoPageView } from "@/app/ui/seo-page-view";

export const metadata: Metadata = pageMetadata({
  title: "Shadcn Form Examples | FormSquid",
  description:
    "Working shadcn/ui forms with a live preview, React Hook Form source, and a Zod schema. Copy the component or customize the same spec with AI.",
  path: "/shadcn",
});

export default function ShadcnIndexPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
      <SeoPageView page="/shadcn" />
      <div className="mb-8 space-y-2">
        <h1 className="font-heading text-4xl font-medium tracking-tight">Shadcn form examples</h1>
        <p className="max-w-xl text-muted-foreground">
          Preview a working form, copy the React component, then customize that spec with AI.
        </p>
      </div>
      <ul className="space-y-3">
        {shadcnPages.map((page) => (
          <li key={page.slug}>
            <Link href={`/shadcn/${page.slug}`} className="block rounded-2xl border p-4 transition-colors hover:bg-muted/40">
              <h2 className="font-medium">{page.title}</h2>
              <p className="text-sm text-muted-foreground">{page.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
