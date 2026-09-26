import type { ReactNode } from "react";
import Link from "next/link";
import { SeoPageView } from "@/app/ui/seo-page-view";

export function LegalDoc({
  title,
  description,
  updated,
  page,
  children,
}: {
  title: string;
  description: string;
  updated: string;
  page: "/privacy" | "/terms";
  children: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10">
      <SeoPageView page={page} />
      <article className="space-y-8">
        <header className="space-y-3 border-b border-border pb-8">
          <p className="text-[11px] font-medium tracking-[0.22em] text-muted-foreground uppercase">
            FormSquid
          </p>
          <h1 className="font-heading text-4xl font-medium tracking-tight sm:text-5xl">{title}</h1>
          <p className="max-w-2xl text-muted-foreground">{description}</p>
          <p className="text-sm text-muted-foreground">Last updated: {updated}</p>
        </header>
        <div className="legal-prose space-y-8 text-sm leading-7 text-muted-foreground [&_a]:text-foreground [&_a]:underline-offset-4 hover:[&_a]:underline [&_h2]:font-heading [&_h2]:text-xl [&_h2]:font-medium [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:text-base [&_h3]:font-medium [&_h3]:text-foreground [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_p]:text-muted-foreground [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
          {children}
        </div>
        <footer className="flex flex-wrap gap-4 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="underline-offset-4 hover:underline">
            Terms of Service
          </Link>
          <Link href="/" className="underline-offset-4 hover:underline">
            Home
          </Link>
        </footer>
      </article>
    </main>
  );
}
