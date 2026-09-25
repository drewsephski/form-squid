import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";

const root = process.cwd();
const projectId = "patient-voice-97966600";
const runId = randomBytes(4).toString("hex");
const branchName = `acceptance-${runId}`;
const slug = `acceptance-${runId}`;
const email = `acceptance-${runId}@example.com`;
const password = "acceptance-pass";
const businessName = `Northwind ${runId}`;

const children: ChildProcess[] = [];
let browser: Browser | undefined;
let branchCreated = false;

const conditionalSpec = {
  schemaVersion: 1,
  title: "Business",
  submitLabel: "Send",
  successMessage: "Sent",
  steps: [
    {
      id: "main",
      title: "Business",
      fields: [
        {
          id: "owns",
          type: "radio",
          label: "Do you own a business?",
          required: true,
          options: [
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ],
        },
        {
          id: "business_name",
          type: "text",
          label: "Business name",
          required: true,
          visibleWhen: { fieldId: "owns", equals: "yes" },
        },
      ],
    },
  ],
};

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed\n${stderr || stdout}`));
    });
  });
}

function start(command: string, args: string[], env: NodeJS.ProcessEnv, cwd: string) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  child.stdout.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
  });
  return child;
}

function freePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not reserve a port."));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

async function waitForOk(url: string) {
  const deadline = Date.now() + 120_000;
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 400) {
        return;
      }
      lastError = `${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "fetch failed";
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url} (${lastError})`);
}

async function connectionString(pooled: boolean) {
  const args = ["connection-string", branchName, "--project-id", projectId];
  if (pooled) {
    args.push("--pooled");
  }
  const output = await run("neon", args);
  const url = output.trim().split("\n").at(-1)?.trim() ?? "";
  if (!url.startsWith("postgres")) {
    throw new Error("Neon did not return a connection string.");
  }
  return url;
}

async function verifySignedInTemplateFlow(page: Page, origin: string, databaseUrl: string) {
  await page.goto(`${origin}/templates/contact`);
  await page.getByRole("button", { name: "Use this template" }).click();
  await page.waitForURL(/\/forms\/.+/);
  const title = (
    await run("psql", [databaseUrl, "-t", "-A", "-c", "select draft_spec->>'title' from forms where draft_spec->>'title' = 'Contact'"])
  ).trim();
  if (title !== "Contact") {
    throw new Error("Signed-in template use did not create a Contact form.");
  }
}

async function publishForm(page: Page, origin: string) {
  await page.addInitScript(
    ([key, spec]) => {
      window.localStorage.setItem(key, spec);
    },
    ["formsquid:pending-spec", JSON.stringify(conditionalSpec)] as const,
  );
  await page.goto(`${origin}/sign-up`);
  await page.getByLabel("Name").fill("Acceptance");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.waitForURL(/\/forms\/.+/);
  await page.getByRole("tab", { name: "Form" }).click();
  await page.locator("#slug").fill(slug);
  await page.getByRole("button", { name: "Publish" }).click();
  await page.getByText("Published", { exact: true }).waitFor();
}

async function installRegistry(origin: string, registryKey: string, consumerDir: string, submitUrl: string) {
  const registryUrl = `${origin}/r/${registryKey}.json`;
  const response = await fetch(registryUrl);
  if (!response.ok) {
    throw new Error(`Registry install failed: ${response.status} ${registryUrl}`);
  }
  const item = (await response.json()) as {
    name: string;
    files: Array<{ path: string; content: string }>;
  };
  if (!item.files?.length) {
    throw new Error("Registry item did not include files.");
  }
  const installDir = path.join(consumerDir, "components", item.name);
  await mkdir(installDir, { recursive: true });
  for (const file of item.files) {
    await writeFile(path.join(installDir, file.path), file.content);
  }
  const formSource = await readFile(path.join(installDir, "form.tsx"), "utf8");
  if (!formSource.includes(submitUrl)) {
    throw new Error(`Installed form does not submit to ${submitUrl}.`);
  }
  await writeFile(
    path.join(consumerDir, "app", "page.tsx"),
    `import { ExportedForm } from "@/components/${item.name}/form";

export default function Page() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <ExportedForm />
    </main>
  );
}
`,
  );
  return registryUrl;
}

async function submitOwnedForm(page: Page, consumerOrigin: string) {
  await page.goto(consumerOrigin);
  await page.getByText("Business name").waitFor({ state: "hidden" });
  await page.getByRole("radio", { name: "Yes" }).click();
  const business = page.getByLabel("Business name");
  await business.waitFor();
  await business.fill(businessName);
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByText("Sent", { exact: true }).waitFor();
}

async function assertSubmission(databaseUrl: string) {
  const output = await run("psql", [databaseUrl, "-t", "-A", "-c", "select payload::text from submissions"]);
  const rows = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const match = rows.some((row) => row.includes(businessName) && row.includes("\"owns\": \"yes\""));
  if (!match) {
    throw new Error("Disposable Postgres did not contain the cross-origin submission.");
  }
}

async function dumpFunctionDiagnostics() {
  const commands: Array<{ label: string; args: string[] }> = [
    {
      label: "neon functions get api",
      args: ["functions", "get", "api", "--branch", branchName, "--project-id", projectId, "--list-env-variables"],
    },
    {
      label: "neon functions list",
      args: ["functions", "list", "--branch", branchName, "--project-id", projectId],
    },
    {
      label: "neon logs query --source function",
      args: ["logs", "query", "--branch", branchName, "--project-id", projectId, "--source", "function", "--since", "1h", "--limit", "50"],
    },
  ];
  for (const command of commands) {
    console.error(`\n--- ${command.label} ---`);
    try {
      console.error(await run("neon", command.args));
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
  }
}

async function cleanup() {
  await browser?.close().catch(() => undefined);
  for (const child of children) {
    child.kill("SIGTERM");
  }
  if (!branchCreated) return;
  if (process.env.ACCEPTANCE_KEEP_BRANCH === "1") {
    console.error(`Keeping disposable branch ${branchName} because ACCEPTANCE_KEEP_BRANCH=1`);
    return;
  }
  await run("neon", ["branches", "delete", branchName, "--project-id", projectId]).catch(
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
    },
  );
}

async function deployFunction() {
  console.log(`Deploying API function on ${branchName}`);
  const acceptanceSalt = randomUUID() + randomUUID();
  await run("neon", [
    "functions",
    "deploy",
    "api",
    "--src",
    "functions/api.ts",
    "--branch",
    branchName,
    "--project-id",
    projectId,
    "--env",
    `RATE_LIMIT_IP_SALT=${acceptanceSalt}`,
  ]);
  const details = await run("neon", [
    "functions",
    "get",
    "api",
    "--branch",
    branchName,
    "--project-id",
    projectId,
  ]);
  const url = details.match(/https:\/\/\S+/)?.[0]?.replace(/\/$/, "");
  if (!url) {
    throw new Error(`Neon did not return a function URL.\n${details}`);
  }
  try {
    await waitForOk(`${url}/health`);
  } catch (error) {
    await dumpFunctionDiagnostics();
    throw error;
  }
  return url;
}

async function main() {
  console.log(`Creating disposable branch ${branchName}`);
  await run("neon", ["branches", "create", "--name", branchName, "--project-id", projectId, "--no-secrets", "--schema-only"]);
  branchCreated = true;
  const pooled = await connectionString(true);
  const direct = await connectionString(false);
  const formsTable = (await run("psql", [direct, "-t", "-A", "-c", "select to_regclass('public.forms')"])).trim();
  if (!formsTable) {
    await run("psql", [direct, "-v", "ON_ERROR_STOP=1", "-f", path.join(root, "db/migrations/0000_silly_dreadnoughts.sql")]);
  }
  const draftSlug = (
    await run("psql", [direct, "-t", "-A", "-c", "select column_name from information_schema.columns where table_name = 'forms' and column_name = 'draft_slug'"])
  ).trim();
  if (!draftSlug) {
    await run("psql", [direct, "-v", "ON_ERROR_STOP=1", "-f", path.join(root, "db/migrations/0002_draft_slug.sql")]);
  }
  const formWebhooks = (await run("psql", [direct, "-t", "-A", "-c", "select to_regclass('public.form_webhooks')"])).trim();
  if (!formWebhooks) {
    await run("psql", [direct, "-v", "ON_ERROR_STOP=1", "-f", path.join(root, "db/migrations/0003_fantastic_edwin_jarvis.sql")]);
  }

  const functionOrigin = await deployFunction();
  const formsquidPort = await freePort();
  const consumerPort = await freePort();
  const formsquidOrigin = `http://127.0.0.1:${formsquidPort}`;
  const consumerOrigin = `http://127.0.0.1:${consumerPort}`;
  const secret = randomUUID() + randomUUID();

  const nextBin = path.join(root, "node_modules", ".bin", "next");
  start(nextBin, ["dev", "--port", String(formsquidPort), "--hostname", "127.0.0.1"], {
    ...process.env,
    DATABASE_URL: pooled,
    DATABASE_URL_UNPOOLED: direct,
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: formsquidOrigin,
    NEXT_PUBLIC_APP_ORIGIN: formsquidOrigin,
    NEXT_PUBLIC_ROOT_DOMAIN: "formsquid.test",
    FORM_API_ORIGIN: functionOrigin,
    NEXT_DIST_DIR: ".next-acceptance",
  }, root);
  await waitForOk(`${formsquidOrigin}/sign-up`);

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await publishForm(page, formsquidOrigin);
  await verifySignedInTemplateFlow(page, formsquidOrigin, direct);

  const registryKey = (
    await run("psql", [
      direct,
      "-t",
      "-A",
      "-c",
      `select registry_key from forms where slug = '${slug}'`,
    ])
  ).trim();
  if (!registryKey) {
    throw new Error("Publish did not store a registry key.");
  }

  const consumerDir = path.join(root, ".tmp", `acceptance-consumer-${runId}`);
  await rm(consumerDir, { recursive: true, force: true });
  await cp(path.join(root, "acceptance", "consumer"), consumerDir, { recursive: true });
  await cp(path.join(root, "components", "ui"), path.join(consumerDir, "components", "ui"), { recursive: true });
  await mkdir(path.join(consumerDir, "lib"), { recursive: true });
  await cp(path.join(root, "lib", "utils.ts"), path.join(consumerDir, "lib", "utils.ts"));
  const submitUrl = `${functionOrigin}/forms/${slug}/submissions`;
  const registryUrl = await installRegistry(formsquidOrigin, registryKey, consumerDir, submitUrl);
  console.log(`Installed ${registryUrl}`);

  start(
    nextBin,
    ["dev", "--port", String(consumerPort), "--hostname", "127.0.0.1"],
    { ...process.env, NEXT_PUBLIC_APP_ORIGIN: consumerOrigin },
    consumerDir,
  );
  await waitForOk(consumerOrigin);
  await submitOwnedForm(page, consumerOrigin);
  await assertSubmission(direct);
  console.log("Acceptance passed: owned form submitted and the row is in Postgres.");
}

process.on("SIGINT", () => {
  void cleanup().finally(() => process.exit(1));
});

main()
  .then(() => cleanup())
  .catch(async (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    await cleanup();
    process.exit(1);
  });
