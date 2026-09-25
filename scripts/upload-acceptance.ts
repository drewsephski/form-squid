/**
 * Disposable Neon-branch acceptance for file uploads + FK claim ordering.
 * Uses psql + Neon Functions HTTP (same style as scripts/acceptance.ts).
 */
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const projectId = "patient-voice-97966600";
const runId = randomBytes(4).toString("hex");
const branchName = `upload-acc-${runId}`;
const slug = `upload-${runId}`;

let branchCreated = false;

const resumeSpec = {
  schemaVersion: 1,
  title: "Resume",
  submitLabel: "Send",
  successMessage: "Sent",
  steps: [
    {
      id: "main",
      title: "Main",
      fields: [
        { id: "name", type: "text", label: "Name", required: true },
        {
          id: "resume",
          type: "file",
          label: "Resume",
          required: true,
          maxFiles: 1,
          maxFileSizeMb: 10,
          accept: ["application/pdf"],
        },
      ],
    },
  ],
};

const tinyPdf = Buffer.from("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");

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

async function connectionString(pooled: boolean) {
  const args = ["connection-string", branchName, "--project-id", projectId];
  if (pooled) args.push("--pooled");
  const output = await run("neon", args);
  const url = output.trim().split("\n").at(-1)?.trim() ?? "";
  if (!url.startsWith("postgres")) {
    throw new Error("Neon did not return a connection string.");
  }
  return url;
}

async function waitForOk(url: string) {
  const deadline = Date.now() + 120_000;
  let lastError = "no response";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 400) return;
      lastError = `${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "fetch failed";
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url} (${lastError})`);
}

async function applyMigrations(direct: string) {
  for (const file of [
    "0000_silly_dreadnoughts.sql",
    "0001_thin_slyde.sql",
    "0002_draft_slug.sql",
    "0003_fantastic_edwin_jarvis.sql",
    "0004_nice_master_mold.sql",
  ]) {
    try {
      await run("psql", [direct, "-v", "ON_ERROR_STOP=1", "-f", path.join(root, "db/migrations", file)]);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/already exists|duplicate/i.test(message)) {
        throw error;
      }
    }
  }
}

async function pullStorageEnv() {
  const envFile = path.join(root, ".tmp", `upload-acc-${runId}.env`);
  await mkdir(path.dirname(envFile), { recursive: true });
  await run("neon", [
    "env",
    "pull",
    "--branch",
    branchName,
    "--project-id",
    projectId,
    "--file",
    envFile,
    "--service",
    "object-storage",
  ]);
  const text = await readFile(envFile, "utf8");
  await unlink(envFile).catch(() => undefined);
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (match[1]!.startsWith("AWS_")) {
      process.env[match[1]!] = value;
    }
  }
  if (!process.env.AWS_ENDPOINT_URL_S3) {
    throw new Error("Branch storage env missing AWS_ENDPOINT_URL_S3 after neon env pull.");
  }
}

async function deployFunction(acceptanceSalt: string) {
  console.log(`Deploying API function on ${branchName}`);
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
  if (!url) throw new Error(`Neon did not return a function URL.\n${details}`);
  await waitForOk(`${url}/health`);
  return url;
}

async function sql(direct: string, query: string) {
  return (await run("psql", [direct, "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", query])).trim();
}

async function assertFkOrderConstraint(direct: string) {
  const userId = randomUUID();
  const formId = randomUUID();
  const versionId = randomUUID();
  const uploadId = randomUUID();
  const missingSubmissionId = randomUUID();
  const formSlug = `fk-${runId}`;

  await sql(
    direct,
    `insert into "user" (id, name, email, email_verified, created_at, updated_at)
     values ('${userId}', 'FK', 'fk-${runId}@example.com', true, now(), now())`,
  );
  await sql(
    direct,
    `insert into forms (id, user_id, slug, draft_slug, registry_key, draft_spec, current_published_version_id, created_at, updated_at)
     values ('${formId}', '${userId}', '${formSlug}', '${formSlug}', '${randomUUID()}', '{}'::jsonb, '${versionId}', now(), now())`,
  );
  await sql(
    direct,
    `insert into form_versions (id, form_id, version_number, spec, created_at)
     values ('${versionId}', '${formId}', 1, '{}'::jsonb, now())`,
  );
  await sql(
    direct,
    `insert into submission_files
      (id, form_id, submission_id, field_id, storage_key, original_filename, content_type, size_bytes, actor_hash, created_at)
     values ('${uploadId}', '${formId}', null, 'resume', 'forms/${formId}/uploads/${uploadId}', 'resume.pdf', 'application/pdf', 10, 'actor', now())`,
  );

  let rejected = false;
  try {
    await sql(
      direct,
      `update submission_files set submission_id = '${missingSubmissionId}' where id = '${uploadId}'`,
    );
  } catch (error) {
    rejected = true;
    const message = error instanceof Error ? error.message : String(error);
    if (!/foreign key|violates/i.test(message)) {
      throw new Error(`Expected FK violation, got: ${message}`);
    }
  }
  if (!rejected) {
    throw new Error("FK-order bug would not have been caught: pre-insert claim succeeded.");
  }
  console.log("FK ordering constraint verified.");
}

async function seedPublishedForm(direct: string, formSlug: string) {
  const userId = randomUUID();
  const formId = randomUUID();
  const versionId = randomUUID();
  const specJson = JSON.stringify(resumeSpec).replace(/'/g, "''");
  await sql(
    direct,
    `insert into "user" (id, name, email, email_verified, created_at, updated_at)
     values ('${userId}', 'Upload', '${formSlug}@example.com', true, now(), now())`,
  );
  await sql(
    direct,
    `insert into forms (id, user_id, slug, draft_slug, registry_key, draft_spec, current_published_version_id, created_at, updated_at)
     values ('${formId}', '${userId}', '${formSlug}', '${formSlug}', '${randomUUID()}', '${specJson}'::jsonb, '${versionId}', now(), now())`,
  );
  await sql(
    direct,
    `insert into form_versions (id, form_id, version_number, spec, created_at)
     values ('${versionId}', '${formId}', 1, '${specJson}'::jsonb, now())`,
  );
  return { userId, formId, versionId };
}

async function uploadViaPresign(upload: {
  method: string;
  url: string;
  fields?: Record<string, string>;
}) {
  if (upload.method === "POST" && upload.fields) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(upload.fields)) {
      formData.append(key, value);
    }
    formData.append("file", new Blob([tinyPdf], { type: "application/pdf" }), "resume.pdf");
    const response = await fetch(upload.url, { method: "POST", body: formData });
    if (!response.ok) {
      throw new Error(`presigned POST failed: ${response.status} ${await response.text()}`);
    }
    return;
  }
  const response = await fetch(upload.url, {
    method: "PUT",
    headers: { "Content-Type": "application/pdf" },
    body: tinyPdf,
  });
  if (!response.ok) {
    throw new Error(`presigned PUT failed: ${response.status} ${await response.text()}`);
  }
}

async function cleanup() {
  if (!branchCreated) return;
  if (process.env.ACCEPTANCE_KEEP_BRANCH === "1") {
    console.error(`Keeping disposable branch ${branchName}`);
    return;
  }
  await run("neon", ["branches", "delete", branchName, "--project-id", projectId]).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
  });
}

async function main() {
  console.log(`Creating disposable branch ${branchName}`);
  await run("neon", [
    "branches",
    "create",
    "--name",
    branchName,
    "--project-id",
    projectId,
    "--no-secrets",
    "--schema-only",
  ]);
  branchCreated = true;

  const direct = await connectionString(false);
  await applyMigrations(direct);
  const acceptanceSalt = randomUUID() + randomUUID();
  // neon.ts only forwards RATE_LIMIT_IP_SALT when present in the deploy environment.
  process.env.RATE_LIMIT_IP_SALT = acceptanceSalt;
  await run("neon", [
    "deploy",
    "--branch",
    branchName,
    "--project-id",
    projectId,
    "--no-env-pull",
    "--update-existing",
  ]);
  await pullStorageEnv();

  await assertFkOrderConstraint(direct);

  const functionOrigin = await deployFunction(acceptanceSalt);
  const { formId } = await seedPublishedForm(direct, slug);

  const authResponse = await fetch(`${functionOrigin}/forms/${slug}/uploads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fieldId: "resume",
      filename: "resume.pdf",
      contentType: "application/pdf",
      size: tinyPdf.length,
    }),
  });
  const authBody = (await authResponse.json()) as {
    ok?: boolean;
    uploadId?: string;
    upload?: { method: string; url: string; fields?: Record<string, string> };
    error?: string;
  };
  if (!authResponse.ok || !authBody.uploadId || !authBody.upload) {
    throw new Error(`authorize failed: ${authResponse.status} ${JSON.stringify(authBody)}`);
  }

  await uploadViaPresign(authBody.upload);

  const submitResponse = await fetch(`${functionOrigin}/forms/${slug}/submissions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Ada Lovelace", resume: authBody.uploadId }),
  });
  const submitBody = await submitResponse.json();
  if (!submitResponse.ok || !(submitBody as { ok?: boolean }).ok) {
    throw new Error(`submit failed: ${submitResponse.status} ${JSON.stringify(submitBody)}`);
  }

  const payload = await sql(
    direct,
    `select s.payload::text
     from submissions s
     join submission_files f on f.submission_id = s.id
     where s.form_id = '${formId}'
     limit 1`,
  );
  if (!payload) {
    throw new Error("Expected submission with attached submission_files row.");
  }
  if (!payload.includes("resume.pdf") || !payload.includes("application/pdf")) {
    throw new Error(`Payload missing normalized file metadata: ${payload}`);
  }
  if (
    payload.includes("storage_key") ||
    payload.includes("storageKey") ||
    payload.includes("AWS_") ||
    /https?:\/\//.test(payload)
  ) {
    throw new Error(`Payload leaked storage details: ${payload}`);
  }
  if (payload.includes(`"${authBody.uploadId}"`) && !payload.includes('"contentType"')) {
    throw new Error(`Payload still looks like a bare upload id: ${payload}`);
  }

  const attached = await sql(
    direct,
    `select count(*)::text from submission_files
     where form_id = '${formId}' and id = '${authBody.uploadId}' and submission_id is not null`,
  );
  if (attached !== "1") {
    throw new Error("submission_files row was not claimed.");
  }

  // Hosted registry source should mention the uploads API; callback source uses browser Files.
  const fixtureDir = path.join(root, ".tmp", `upload-acc-source-${runId}`);
  await mkdir(fixtureDir, { recursive: true });
  await writeFile(
    path.join(fixtureDir, "note.txt"),
    "callback source supplies browser File objects; hosted registry uses /uploads",
  );

  console.log("Upload acceptance passed (FK order + authorize/upload/submit + metadata).");
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
