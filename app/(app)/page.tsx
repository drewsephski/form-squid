import { Generator } from "@/app/ui/generator";
import { TemplateSection } from "@/app/ui/template-section";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-8">
      <div className="my-auto space-y-8">
        <div className="space-y-4 text-center">
          <p className="text-[11px] font-medium tracking-[0.22em] text-muted-foreground uppercase">Generate it. Host it. Own the code.</p>
          <h1 className="font-heading text-5xl leading-[1.05] font-medium tracking-tight text-balance sm:text-6xl">
            Build production-ready forms with AI.
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Prompt once and get a live hosted form, shadcn/ui source, validation, and a submissions inbox.
          </p>
        </div>
        <Generator />
        <TemplateSection />
      </div>
    </main>
  );
}
