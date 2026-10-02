import { compileForm, type CompileTarget } from "../compiler";
import type { FormSpec } from "../definitions";
import { appOrigin } from "../origin";
import { templates } from "../templates";
import { shadcnPages } from "./pages";
import ts from "typescript";
import { readFileSync } from "node:fs";
import path from "node:path";

// Only curated examples belong in the public catalog. Customer forms stay key-scoped.
export const registryForms = [
  ...shadcnPages.map((page) => ({ name: page.slug, title: page.spec.title, description: page.description, spec: page.spec })),
  ...templates
    .filter((template) => !shadcnPages.some((page) => page.slug === `${template.slug}-form`))
    .map((template) => ({ name: `${template.slug}-form`, title: template.name, description: template.description, spec: template.spec })),
];

export function createRegistryItem(name: string, spec: FormSpec, target: CompileTarget, description: string) {
  const compiled = compileForm(spec, target);
  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name,
    type: "registry:block" as const,
    title: spec.title,
    description,
    dependencies: ["react-hook-form", "@hookform/resolvers", "zod", "date-fns", "lucide-react"],
    registryDependencies: compiled.registryDependencies.map((dependency) => dependency === "form" ? `${appOrigin()}/r/form-helper.json` : dependency),
    files: [
      // The embedded validator is JavaScript; ship it as such instead of relying on
      // @ts-nocheck, which the CLI removes when it transforms registry source.
      { path: `registry/formsquid/${name}/formsquid-${name}-schema.js`, target: `@components/formsquid/${name}/formsquid-${name}-schema.js`, type: "registry:component" as const, content: ts.transpileModule(compiled.schemaSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, removeComments: true } }).outputText },
      // Unique basenames prevent the CLI from mistaking this component for its
      // own `form` registry dependency and rewriting the helper import to itself.
      { path: `registry/formsquid/${name}/formsquid-${name}.tsx`, target: `@components/formsquid/${name}/formsquid-${name}.tsx`, type: "registry:component" as const, content: compiled.formSource.replace('from "./schema"', `from "./formsquid-${name}-schema"`) },
    ],
  };
}

// Modern shadcn bases no longer publish the legacy RHF `form` item. Deliver
// the project's existing accessible wrappers as an explicit registry dependency.
export function createFormHelperItem() {
  return {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name: "form-helper",
    type: "registry:ui" as const,
    dependencies: ["react-hook-form"],
    registryDependencies: ["label"],
    files: [{
      path: "registry/formsquid/form-helper/form.tsx",
      target: "@ui/form.tsx",
      type: "registry:ui" as const,
      content: readFileSync(path.join(process.cwd(), "components/ui/form.tsx"), "utf8"),
    }],
  };
}

export function createRegistryIndex(items: Array<{ name: string; title: string; description: string }>) {
  return {
    $schema: "https://ui.shadcn.com/schema/registry.json",
    name: "formsquid",
    homepage: appOrigin(),
    items: items.map(({ name, title, description }) => ({ name, title, description, type: "registry:block" as const })),
  };
}

export const publishedFormDescription = "Published FormSquid form. Submits to its hosted endpoint and stores responses in the FormSquid inbox. Republish to update the installed source.";
