import { createRegistryIndex, createRegistryItem, registryForms } from "../shadcn/registry";
import { registryConfig } from "../shadcn/mcp-config";
import { contact } from "../templates/contact";
import { GET as publicGet } from "../../r/[registryKey]/route";
import { GET as scopedGet } from "../../r/published/[registryKey]/[name]/route";
import { getPublishedByRegistryKey } from "../published";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { formSpecSchema } from "../definitions";

jest.mock("../published", () => ({ getPublishedByRegistryKey: jest.fn() }));
const publishedLookup = jest.mocked(getPublishedByRegistryKey);
const key = "a".repeat(48);
const request = new Request("https://formsquid.com/r/registry.json");

beforeEach(() => {
  jest.clearAllMocks();
  process.env.FORM_API_ORIGIN = "https://api.formsquid.test";
});

test("public MCP catalog includes each example and template with unique installable names", () => {
  expect(new Set(registryForms.map((form) => form.name)).size).toBe(registryForms.length);
  expect(registryForms.map((form) => form.name)).toEqual(expect.arrayContaining(["contact-form", "conditional-form", "multi-step-form", "rsvp-form", "project-request-form", "lead-generation-form"]));
  for (const form of registryForms) {
    const item = createRegistryItem(form.name, form.spec, { submission: "callback" }, form.description);
    expect(item.files.map((file) => file.target)).toEqual([
      `@components/formsquid/${form.name}/formsquid-${form.name}-schema.js`,
      `@components/formsquid/${form.name}/formsquid-${form.name}.tsx`,
    ]);
    expect(item.files[1].content).toContain(`from "./formsquid-${form.name}-schema"`);
    expect(item.files[1].content).toContain("onSubmit:");
  }
});

test("public index contains curated metadata and does not query customer forms", async () => {
  const response = await publicGet(request, { params: Promise.resolve({ registryKey: "registry.json" }) });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(createRegistryIndex(registryForms));
  expect(publishedLookup).not.toHaveBeenCalled();
});

test("public example resolves without database access and unknown names fail closed", async () => {
  const response = await publicGet(request, { params: Promise.resolve({ registryKey: "contact-form.json" }) });
  expect((await response.json()).name).toBe("contact-form");
  const missing = await publicGet(request, { params: Promise.resolve({ registryKey: "customer-draft.json" }) });
  expect(missing.status).toBe(404);
  expect(publishedLookup).not.toHaveBeenCalled();
});

test("scoped catalog exposes exactly the form addressed by the key and uses published source", async () => {
  publishedLookup.mockResolvedValue({ slug: "my-contact", spec: contact.spec });
  const index = await scopedGet(request, { params: Promise.resolve({ registryKey: key, name: "registry.json" }) });
  expect(index.headers.get("Cache-Control")).toBe("private, no-store");
  expect((await index.json()).items).toHaveLength(1);
  const response = await scopedGet(request, { params: Promise.resolve({ registryKey: key, name: "published-form.json" }) });
  const item = await response.json();
  expect(item.name).toBe("published-form");
  expect(item.files[1].content).toContain("https://api.formsquid.test/forms/my-contact/submissions");
  expect(item.files[1].content).not.toContain("onSubmit:");
  const other = await scopedGet(request, { params: Promise.resolve({ registryKey: key, name: "other-form.json" }) });
  expect(other.status).toBe(404);
  expect(publishedLookup).toHaveBeenCalledWith(key);
});

test("unpublished, deleted, and malformed scoped keys cannot be installed", async () => {
  publishedLookup.mockResolvedValue(null);
  const missing = await scopedGet(request, { params: Promise.resolve({ registryKey: key, name: "registry.json" }) });
  expect(missing.status).toBe(404);
  jest.clearAllMocks();
  const invalid = await scopedGet(request, { params: Promise.resolve({ registryKey: "invalid", name: "registry.json" }) });
  expect(invalid.status).toBe(404);
  expect(publishedLookup).not.toHaveBeenCalled();
});

test("legacy direct published install uses the same correctly targeted files", async () => {
  publishedLookup.mockResolvedValue({ slug: "my-contact", spec: contact.spec });
  const response = await publicGet(request, { params: Promise.resolve({ registryKey: `${key}.json` }) });
  expect((await response.json()).files[0].target).toBe("@components/formsquid/my-contact/formsquid-my-contact-schema.js");
});

test("consumer configuration distinguishes curated and key-scoped registries", () => {
  expect(JSON.parse(registryConfig()).registries["@formsquid"]).toMatch(/\/r\/\{name\}\.json$/);
  expect(JSON.parse(registryConfig(key)).registries["@formsquid-published"]).toMatch(new RegExp(`/r/published/${key}/\\{name\\}\\.json$`));
});

test("customer slugs matching shadcn helpers have distinct source filenames", () => {
  const item = createRegistryItem("form", contact.spec, { submission: "callback" }, "Contact form");
  expect(item.files[1].path).toMatch(/\/formsquid-form\.tsx$/);
  expect(item.files[1].content).toContain('from "@/components/ui/form"');
});

test("installed Zod schema executes embedded file validation without app imports", () => {
  const spec = formSpecSchema.parse({
    schemaVersion: 1, title: "Files", submitLabel: "Send", successMessage: "Sent",
    steps: [{ id: "main", title: "Files", fields: [{ id: "resume", type: "file", label: "Resume", required: true, accept: ["application/pdf"] }] }],
  });
  const item = createRegistryItem("files", spec, { submission: "callback" }, "File form");
  const exports: Record<string, z.ZodType> = {};
  const source = ts.transpileModule(item.files[0].content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(source, { exports, require: (id: string) => {
    expect(id).toBe("zod");
    return { z };
  } });
  expect(exports.submissionSchema.safeParse({}).success).toBe(false);
  expect(exports.submissionSchema.safeParse({ resume: { name: "cv.pdf", size: 100, type: "application/pdf" } }).success).toBe(true);
  expect(exports.submissionSchema.safeParse({ resume: { name: "cv.exe", size: 100, type: "application/octet-stream" } }).success).toBe(false);
});

test("scoped item remains addressable when the hosted slug is registry", async () => {
  publishedLookup.mockResolvedValue({ slug: "registry", spec: contact.spec });
  const response = await scopedGet(request, { params: Promise.resolve({ registryKey: key, name: "published-form.json" }) });
  const item = await response.json();
  expect(item.name).toBe("published-form");
  expect(item.files[1].content).toContain("https://api.formsquid.test/forms/registry/submissions");
});
