import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { FormTemplate } from "@/app/lib/templates/types";
import { FormMiniPreview } from "@/app/ui/form-mini-preview";

export function TemplateCard({ template, headingLevel = 2 }: { template: FormTemplate; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <Link
      href={`/templates/${template.slug}`}
      className="group grid min-w-0 grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:block sm:space-y-4 sm:rounded-2xl sm:p-4"
    >
      <FormMiniPreview spec={template.spec} previewId={template.slug} className="h-24 sm:h-64" />
      <div className="min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Heading className="text-sm font-medium sm:text-base">{template.name}</Heading>
          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground sm:hidden" />
        </div>
        <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{template.description}</p>
        <p className="hidden text-xs text-muted-foreground sm:block">{template.category}</p>
      </div>
    </Link>
  );
}
