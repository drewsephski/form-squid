import type { Metadata } from "next";
import { Generator } from "@/app/ui/generator";
import { SeoPageView } from "@/app/ui/seo-page-view";
import { TemplateSection } from "@/app/ui/template-section";
import { pageMetadata } from "@/app/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "FormSquid",
  description: "Prompt once and get a live hosted form, shadcn/ui source, validation, and a submissions inbox.",
  path: "/",
});

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-6 sm:py-8">
      <SeoPageView page="/" />
      <div className="my-auto space-y-6 sm:space-y-8">
        <div className="space-y-3 text-left sm:space-y-4 sm:text-center">
          <p className="hidden text-[11px] font-medium tracking-[0.22em] text-muted-foreground uppercase sm:block">Generate it. Host it. Own the code.</p>
          <h1 className="font-heading text-[clamp(2rem,8.5vw,2.75rem)] leading-[1.1] font-medium tracking-tight text-balance sm:text-6xl sm:leading-[1.05]">
            Build production-ready forms with AI.
          </h1>
          <p className="mx-auto max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Prompt once and get a live hosted form, shadcn/ui source, validation, and a submissions inbox.
          </p>
        </div>
        <Generator />
        <TemplateSection />
      </div>
    </main>
  );
}
