"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trackFunnel, type FunnelProperties } from "@/app/lib/analytics";

interface SourceTabsProps extends FunnelProperties {
  formSource: string;
  schemaSource: string;
}

export function SourceTabs({ formSource, schemaSource, page, shadcnSlug }: SourceTabsProps) {
  function handleTabChange(value: string) {
    trackFunnel("source_tab_opened", { page: value === "schema" ? `${page}#schema` : page, shadcnSlug });
  }

  return (
    <Tabs defaultValue="component" onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="component">Component</TabsTrigger>
        <TabsTrigger value="schema">Zod schema</TabsTrigger>
      </TabsList>
      <TabsContent value="component">
        <SourceBlock source={formSource} label="Component source" page={page} shadcnSlug={shadcnSlug} />
      </TabsContent>
      <TabsContent value="schema">
        <SourceBlock source={schemaSource} label="Zod schema source" page={page} shadcnSlug={shadcnSlug} />
      </TabsContent>
    </Tabs>
  );
}

function SourceBlock({ source, label, page, shadcnSlug }: { source: string; label: string } & FunnelProperties) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(source);
    setCopied(true);
    trackFunnel("source_copied", { page, shadcnSlug });
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button type="button" variant="outline" className="rounded-full" onClick={() => void handleCopy()} aria-label={`Copy ${label}`}>
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="max-h-[32rem] overflow-auto rounded-xl border bg-muted/40 p-4 text-xs leading-relaxed" tabIndex={0} aria-label={label}>
        <code>{source}</code>
      </pre>
    </div>
  );
}
