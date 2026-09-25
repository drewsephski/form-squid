/**
 * Temporary production smoke for file uploads.
 * Signs up a disposable account, seeds a published PDF form for that owner,
 * submits via the hosted form, checks inbox/DB, then deletes the form/user.
 */
import { spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const root = process.cwd();
const projectId = "patient-voice-97966600";
const runId = randomBytes(3).toString("hex");
const email = `upload.smoke.${runId}@gmail.com`;
const password = `Smoke-${runId}-pass!`;
const slug = `smoke-${runId}`;
const tinyPdf = Buffer.from("%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const pdfPath = path.join(root, ".tmp", `smoke-${runId}.pdf`);

const resumeSpec = {
  schemaVersion: 1,
  title: "Upload Smoke",
  submitLabel: "Send",
  successMessage: "Sent",
  steps: [
    {
      id: "main",
      title: "Apply",
      fields: [
        { id: "name", type: "text", label: "Name", required: true },
        { id: "email", type: "email", label: "Email", required: true },
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

function run(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
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
      if (code === 0) resolve(stdout);
      else reject(new Error(`${command} ${args.join(" ")} failed\n${stderr || stdout}`));
    });
  });
}

async function productionDbUrl() {
  const output = await run("neon", ["connection-string", "production", "--project-id", projectId]);
  const url = output.trim().split("\n").at(-1)?.trim() ?? "";
  if (!url.startsWith("postgres")) throw new Error("No production connection string");
  return url;
}

async function sql(direct: string, query: string) {
  return (await run("psql", [direct, "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", query])).trim();
}

async function main() {
  await mkdir(path.dirname(pdfPath), { recursive: true });
  await writeFile(pdfPath, tinyPdf);
  const direct = await productionDbUrl();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  let formId = "";
  let userId = "";

  try {
    await page.goto("https://formsquid.com/sign-up");
    await page.getByLabel("Name").fill("Upload Smoke");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL(/\/forms(\/|$|\?)/, { timeout: 60_000 });
    await page.getByText("My forms", { exact: false }).first().waitFor({ timeout: 30_000 });

    userId = await sql(direct, `select id from "user" where email = '${email}'`);
    if (!userId) {
      // Retry briefly for replication lag on the unpooled writer.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      userId = await sql(direct, `select id from "user" where email = '${email}'`);
    }
    if (!userId) throw new Error(`Smoke user was not created for ${email}.`);

    formId = randomUUID();
    const versionId = randomUUID();
    const specJson = JSON.stringify(resumeSpec).replace(/'/g, "''");
    await sql(
      direct,
      `insert into forms (id, user_id, slug, draft_slug, registry_key, draft_spec, current_published_version_id, created_at, updated_at)
       values ('${formId}', '${userId}', '${slug}', '${slug}', '${randomUUID()}', '${specJson}'::jsonb, '${versionId}', now(), now())`,
    );
    await sql(
      direct,
      `insert into form_versions (id, form_id, version_number, spec, created_at)
       values ('${versionId}', '${formId}', 1, '${specJson}'::jsonb, now())`,
    );

    await page.goto(`https://${slug}.formsquid.com`);
    await page.getByLabel("Name").fill("Ada Lovelace");
    await page.getByLabel("Email").fill("ada@example.com");
    // Playwright path uploads often omit MIME; set it explicitly so authorize accepts PDF.
    await page.locator('input[type="file"]').setInputFiles({
      name: "resume.pdf",
      mimeType: "application/pdf",
      buffer: tinyPdf,
    });
    await page.getByText("resume.pdf", { exact: false }).first().waitFor({ timeout: 60_000 });
    const fieldError = page.getByText(/not allowed|incomplete|Could not|Upload failed/i);
    if (await fieldError.count()) {
      throw new Error(`Upload UI error: ${await fieldError.first().innerText()}`);
    }
    await page.getByRole("button", { name: "Send" }).click();
    await page.getByText("Sent", { exact: true }).waitFor({ timeout: 60_000 });
    console.log("Public submit succeeded.");

    await page.goto(`https://formsquid.com/forms/${formId}`);
    const resumeRow = page.locator("li", { hasText: "resume.pdf" }).first();
    await resumeRow.waitFor({ timeout: 30_000 });
    const rowText = await resumeRow.innerText();
    if (!/\d+(\.\d+)?\s?(B|KB|MB)/i.test(rowText)) {
      throw new Error(`Inbox row missing verified size: ${rowText}`);
    }
    console.log("Inbox shows filename and size:", rowText.replace(/\s+/g, " ").trim());

    const popupPromise = page.waitForEvent("popup", { timeout: 30_000 });
    await resumeRow.getByRole("button", { name: "Download" }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded").catch(() => undefined);
    const downloadUrl = popup.url();
    if (!downloadUrl || downloadUrl === "about:blank") {
      throw new Error("Download did not open a signed URL popup.");
    }
    const signed = new URL(downloadUrl);
    const responseDisposition =
      signed.searchParams.get("response-content-disposition") ??
      signed.searchParams.get("Response-Content-Disposition") ??
      "";
    if (!/attachment/i.test(responseDisposition) || !/resume\.pdf/i.test(decodeURIComponent(responseDisposition))) {
      throw new Error(
        `Signed URL missing attachment Content-Disposition override: ${decodeURIComponent(responseDisposition) || "<empty>"}`,
      );
    }
    const downloadResponse = await page.request.get(downloadUrl);
    if (!downloadResponse.ok()) {
      throw new Error(`Signed download HTTP ${downloadResponse.status()}`);
    }
    const body = Buffer.from(await downloadResponse.body());
    if (!body.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      throw new Error("Downloaded body is not a PDF.");
    }
    console.log("Authenticated download works with attachment Content-Disposition override.");
    await popup.close().catch(() => undefined);

    const payload = await sql(
      direct,
      `select s.payload::text
       from submissions s
       where s.form_id = '${formId}'
       order by s.created_at desc
       limit 1`,
    );
    if (!payload.includes("resume.pdf") || !payload.includes("application/pdf") || !payload.includes('"size"')) {
      throw new Error(`Bad payload metadata: ${payload}`);
    }
    if (payload.includes("storageKey") || payload.includes("AWS_") || /https?:\/\//.test(payload)) {
      throw new Error(`Payload leaked storage details: ${payload}`);
    }

    const attached = await sql(
      direct,
      `select count(*)::text from submission_files
       where form_id = '${formId}' and submission_id is not null`,
    );
    if (attached !== "1") throw new Error(`Expected 1 attached file, got ${attached}`);

    const orphans = await sql(
      direct,
      `select count(*)::text from submission_files
       where form_id = '${formId}' and submission_id is null`,
    );
    if (orphans !== "0") throw new Error(`Unexpected orphan pending uploads: ${orphans}`);

    console.log("Production upload smoke passed.");
  } finally {
    await browser.close().catch(() => undefined);
    await unlink(pdfPath).catch(() => undefined);
    if (formId) {
      await sql(direct, `delete from forms where id = '${formId}'`).catch((error: unknown) => {
        console.error("form cleanup failed", error);
      });
    }
    if (userId) {
      await sql(direct, `delete from "user" where id = '${userId}'`).catch((error: unknown) => {
        console.error("user cleanup failed", error);
      });
    } else {
      await sql(direct, `delete from "user" where email = '${email}'`).catch(() => undefined);
    }
    console.log("Cleanup attempted for temporary smoke account/form.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
