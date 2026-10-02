"use client";

import { CodeBlock } from "@/components/ui/code-block";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mcpCodexConfig, mcpJsonConfig, registryConfig } from "@/app/lib/shadcn/mcp-config";

export function McpSetup({ registryKey, itemName = "contact-form" }: { registryKey?: string; itemName?: string }) {
  const namespace = registryKey ? "@formsquid-published" : "@formsquid";
  return (
    <div className="min-w-0 space-y-4">
      <p className="text-sm text-muted-foreground">
        Connect your assistant to the official shadcn MCP to browse and install forms in your Next.js app.
        Run <code>pnpm dlx shadcn@latest init</code> in that app first if shadcn is not set up.
      </p>
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-medium">1. Add this registry in your app</p>
        <p className="text-sm text-muted-foreground">Merge this entry into your existing components.json registries.</p>
        <CodeBlock code={registryConfig(registryKey)} filename="components.json" language="json" label="FormSquid registry configuration" />
        {registryKey ? <p className="text-xs text-muted-foreground">This link grants access to this published form’s source. Keep it out of public repositories. Republish changes, then reinstall to update your app.</p> : null}
      </div>
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-medium">2. Connect your assistant</p>
        <p className="text-sm text-muted-foreground">Merge the server entry into your client configuration, then restart or enable the shadcn server. Run the assistant from your Next.js app’s directory.</p>
        <Tabs defaultValue="cursor" className="min-w-0">
          <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4">
            <TabsTrigger value="cursor">Cursor</TabsTrigger>
            <TabsTrigger value="claude">Claude Code</TabsTrigger>
            <TabsTrigger value="vscode">VS Code</TabsTrigger>
            <TabsTrigger value="codex">Codex</TabsTrigger>
          </TabsList>
          <TabsContent value="cursor"><CodeBlock code={mcpJsonConfig} filename=".cursor/mcp.json" language="json" label="Cursor MCP configuration" /></TabsContent>
          <TabsContent value="claude"><CodeBlock code={mcpJsonConfig} filename=".mcp.json" language="json" label="Claude Code MCP configuration" /></TabsContent>
          <TabsContent value="vscode"><CodeBlock code={mcpJsonConfig.replace('"mcpServers"', '"servers"')} filename=".vscode/mcp.json" language="json" label="VS Code MCP configuration" /></TabsContent>
          <TabsContent value="codex"><CodeBlock code={mcpCodexConfig} filename="~/.codex/config.toml" language="toml" label="Codex MCP configuration" /></TabsContent>
        </Tabs>
      </div>
      <div className="min-w-0 space-y-2">
        <p className="text-sm font-medium">3. Ask your assistant</p>
        <CodeBlock code={`Install ${namespace}/${itemName} into this Next.js app and add it to a page.${registryKey ? " It submits to FormSquid." : " Wire its onSubmit callback to my API in a client component."}`} language="text" label="Form installation prompt" showLineNumbers={false} wrap />
        <p className="text-sm text-muted-foreground">The CLI installs the component, Zod schema, packages, and shadcn field components together.</p>
      </div>
    </div>
  );
}
