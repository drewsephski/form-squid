import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { registryItemSchema, registrySchema } from "shadcn/schema";

const root = process.cwd();
let server: ChildProcess | undefined;
let client: Client | undefined;

async function run(command: string, args: string[], cwd: string) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} failed (${code})`)));
  });
}

async function freePort() {
  return new Promise<number>((resolve, reject) => {
    const socket = net.createServer();
    socket.on("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const address = socket.address();
      assert(address && typeof address !== "string");
      socket.close(() => resolve(address.port));
    });
  });
}

async function tool(name: string, args: Record<string, unknown>) {
  assert(client);
  const result = await client.callTool({ name, arguments: args });
  assert(!result.isError, `${name}: ${JSON.stringify(result.content)}`);
  return JSON.stringify(result.content);
}

async function main() {
  const consumer = await mkdtemp(path.join(tmpdir(), "formsquid-mcp-consumer-"));
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const registryUrl = `${origin}/r/{name}.json`;
  server = spawn(path.join(root, "node_modules/.bin/next"), ["dev", "--port", String(port), "--hostname", "127.0.0.1"], {
    cwd: root,
    env: { ...process.env, NEXT_PUBLIC_APP_ORIGIN: origin, NEXT_DIST_DIR: ".next-mcp-acceptance" },
    stdio: "inherit",
  });
  const deadline = Date.now() + 90_000;
  let ready = false;
  let itemNames: string[] = [];
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/r/registry.json`);
      if (response.ok) {
        const catalog = registrySchema.parse(await response.json());
        itemNames = catalog.items.map((item) => item.name);
        for (const item of catalog.items) {
          const response = await fetch(`${origin}/r/${item.name}.json`);
          assert(response.ok);
          registryItemSchema.parse(await response.json());
        }
        ready = true;
        break;
      }
    } catch {
      if (server.exitCode !== null) throw new Error("Registry server exited before becoming ready.");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert(ready, "Registry did not become ready or failed schema validation.");

  // No UI files or dependencies are copied from FormSquid: the real CLI installs them.
  await cp(path.join(root, "acceptance/consumer"), consumer, { recursive: true });
  const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  await writeFile(path.join(consumer, "package.json"), JSON.stringify({
    name: "formsquid-mcp-consumer", private: true, packageManager: pkg.packageManager,
    scripts: { build: "next build" },
    dependencies: { next: pkg.dependencies.next, react: pkg.dependencies.react, "react-dom": pkg.dependencies["react-dom"], shadcn: pkg.dependencies.shadcn },
    devDependencies: { typescript: pkg.devDependencies.typescript, "@types/node": pkg.devDependencies["@types/node"], "@types/react": pkg.devDependencies["@types/react"], "@types/react-dom": pkg.devDependencies["@types/react-dom"], tailwindcss: pkg.devDependencies.tailwindcss, "@tailwindcss/postcss": pkg.devDependencies["@tailwindcss/postcss"] },
  }, null, 2));
  const config = JSON.parse(await readFile(path.join(root, "components.json"), "utf8"));
  config.registries = { "@formsquid": registryUrl };
  // Exercise alias-aware target resolution instead of the default components folder.
  config.aliases.components = "@/custom-components";
  config.aliases.ui = "@/custom-components/ui";
  await writeFile(path.join(consumer, "components.json"), JSON.stringify(config, null, 2));
  await run("pnpm", ["install"], consumer);
  await run("pnpm", ["exec", "shadcn", "init", "--defaults", "--force", "--yes"], consumer);
  // init can rewrite configuration; restore the test's namespace and aliases.
  await writeFile(path.join(consumer, "components.json"), JSON.stringify(config, null, 2));

  client = new Client({ name: "formsquid-registry-acceptance", version: "1.0.0" });
  await client.connect(new StdioClientTransport({ command: "node", args: [path.join(root, "node_modules/shadcn/dist/index.js"), "mcp"], cwd: consumer, stderr: "inherit" }));
  const tools = await client.listTools();
  assert(tools.tools.some((entry) => entry.name === "search_items_in_registries"));
  assert((await tool("get_project_registries", {})).includes("@formsquid"));
  assert((await tool("list_items_in_registries", { registries: ["@formsquid"] })).includes("conditional-form"));
  assert((await tool("search_items_in_registries", { registries: ["@formsquid"], query: "contact" })).includes("contact-form"));
  assert((await tool("view_items_in_registries", { items: ["@formsquid/contact-form"] })).includes("contact-form"));
  assert((await tool("get_add_command_for_items", { items: ["@formsquid/contact-form", "@formsquid/conditional-form"] })).includes("@formsquid/contact-form"));
  await client.close();
  client = undefined;

  await run("pnpm", ["exec", "shadcn", "add", ...itemNames.map((name) => `@formsquid/${name}`), "--yes"], consumer);
  const installed = await readFile(path.join(consumer, "custom-components/formsquid/contact-form/formsquid-contact-form.tsx"), "utf8");
  assert(installed.includes('from "./formsquid-contact-form-schema"'));
  assert(installed.includes("@/custom-components/ui/"));
  await readFile(path.join(consumer, "custom-components/formsquid/conditional-form/formsquid-conditional-form-schema.js"), "utf8");
  await writeFile(path.join(consumer, "app/page.tsx"), `"use client";
import { useState } from "react";
import { ExportedForm } from "@/custom-components/formsquid/contact-form/formsquid-contact-form";
export default function Page() {
  const [submitted, setSubmitted] = useState<Record<string, unknown> | null>(null);
  return <main className="mx-auto max-w-xl p-8"><ExportedForm onSubmit={setSubmitted} />{submitted && <pre>{JSON.stringify(submitted)}</pre>}</main>;
}
`);
  await run("pnpm", ["exec", "tsc", "--noEmit"], consumer);
  await run("pnpm", ["build"], consumer);
  console.log(`MCP acceptance passed: real discovery, search, inspection, CLI installation, custom aliases, typecheck, and Next.js build. Consumer: ${consumer}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await client?.close();
  server?.kill("SIGTERM");
});
