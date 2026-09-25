"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock } from "@/components/ui/code-block";
import { trackFunnel, type FunnelProperties } from "@/app/lib/analytics";

interface SourceTabsProps extends FunnelProperties {
  formSource: string;
  schemaSource: string;
}

export function SourceTabs({ formSource, schemaSource, page, shadcnSlug }: SourceTabsProps) {
  function handleTabChange(value: string) {
    trackFunnel("source_tab_opened", { page: value === "schema" ? `${page}#schema` : page, shadcnSlug });
  }

  function handleCopy() {
    trackFunnel("source_copied", { page, shadcnSlug });
  }

  return (
    <Tabs defaultValue="component" onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="component">Component</TabsTrigger>
        <TabsTrigger value="schema">Zod schema</TabsTrigger>
      </TabsList>
      <TabsContent value="component">
        <CodeBlock
          code={formSource}
          filename="form.tsx"
          label="Component source"
          language="tsx"
          maxHeight="32rem"
          onCopy={handleCopy}
        />
      </TabsContent>
      <TabsContent value="schema">
        <CodeBlock
          code={schemaSource}
          filename="schema.ts"
          label="Zod schema source"
          language="ts"
          maxHeight="32rem"
          onCopy={handleCopy}
        />
      </TabsContent>
    </Tabs>
  );
}
