"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SourceTabsProps {
  formSource: string;
  schemaSource: string;
}

export function SourceTabs({ formSource, schemaSource }: SourceTabsProps) {
  return (
    <Tabs defaultValue="component">
      <TabsList>
        <TabsTrigger value="component">Component</TabsTrigger>
        <TabsTrigger value="schema">Zod schema</TabsTrigger>
      </TabsList>
      <TabsContent value="component">
        <SourceBlock source={formSource} label="Component source" />
      </TabsContent>
      <TabsContent value="schema">
        <SourceBlock source={schemaSource} label="Zod schema source" />
      </TabsContent>
    </Tabs>
  );
}

function SourceBlock({ source, label }: { source: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(source);
    setCopied(true);
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
