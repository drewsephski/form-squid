import { appOrigin } from "../origin";

export function formRegistryUrl(registryKey?: string) {
  return registryKey
    ? `${appOrigin()}/r/published/${registryKey}/{name}.json`
    : `${appOrigin()}/r/{name}.json`;
}

export function registryConfig(registryKey?: string) {
  return JSON.stringify({ registries: { [registryKey ? "@formsquid-published" : "@formsquid"]: formRegistryUrl(registryKey) } }, null, 2);
}

export const mcpJsonConfig = JSON.stringify({ mcpServers: { shadcn: { command: "npx", args: ["shadcn@latest", "mcp"] } } }, null, 2);
export const mcpCodexConfig = '[mcp_servers.shadcn]\ncommand = "npx"\nargs = ["shadcn@latest", "mcp"]';
