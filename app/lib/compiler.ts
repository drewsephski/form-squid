import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { appearanceClassName, appearanceStyle, resolveAppearance, submitClassName } from "./appearance";
import { formSpecSchema, type FormSpec } from "./definitions";

export type CompiledForm = {
  schemaSource: string;
  formSource: string;
  registryDependencies: string[];
};

function embeddedAlgorithm(): string {
  const source = readFileSync(
    path.join(process.cwd(), "app/lib/submission-algorithm.ts"),
    "utf8",
  );
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;

  return javascript
    .replace(/^export /gm, "")
    .replace(/^import .*$/gm, "")
    .trim();
}

function registryDependencies(): string[] {
  return ["button", "checkbox", "form", "input", "label", "radio-group", "select", "textarea"];
}

function schemaSource(spec: FormSpec): string {
  const specLiteral = JSON.stringify(spec, null, 2);
  const stepEntries = spec.steps
    .map((step) => `  [${JSON.stringify(step.id)}]: createSchema(${JSON.stringify(step.id)})`)
    .join(",\n");

  return `// @ts-nocheck
import { z } from "zod";

const spec = ${specLiteral};

${embeddedAlgorithm()}

function createSchema(stepId) {
  return z.any().superRefine((value, context) => {
    const result = validatePayload(spec, value, stepId);
    if (!result.ok) {
      for (const error of result.errors) {
        context.addIssue({
          code: "custom",
          path: error.path ? [error.path] : [],
          message: error.message,
        });
      }
    }
  }).transform((value) => {
    const result = validatePayload(spec, value, stepId);
    return result.ok ? result.data : value;
  });
}

export const submissionSchema = createSchema(undefined);

export const stepSchemas = {
${stepEntries}
};
`;
}

export type CompileTarget =
  | { submission: "formsquid"; url: string }
  | { submission: "callback" };

function formSource(spec: FormSpec, target: CompileTarget): string {
  const appearance = resolveAppearance(spec);
  const hosted = target.submission === "formsquid";
  const submitBinding = hosted ? `const submitUrl = ${JSON.stringify(target.url)};\n` : "";
  const componentSignature = hosted
    ? "export function ExportedForm() {"
    : `export function ExportedForm({
  onSubmit,
}: {
  onSubmit: (data: Record<string, unknown>) => void | Promise<void>;
}) {`;
  const honeypotState = hosted ? `  const [honeypot, setHoneypot] = useState("");\n` : "";
  const submitHandler = hosted
    ? `  async function handleSubmit(values: unknown) {
    setSubmitError("");
    if (honeypot) {
      setDone(true);
      return;
    }
    try {
      const response = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...((values as Record<string, unknown>) ?? {}), _gotcha: honeypot }),
      });
      if (response.ok) {
        setDone(true);
        return;
      }
      const body = await response.json().catch(() => null);
      const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Could not submit. Try again.";
      setSubmitError(message);
    } catch {
      setSubmitError("Could not submit. Try again.");
    }
  }`
    : `  async function handleSubmit(values: unknown) {
    setSubmitError("");
    try {
      await onSubmit(((values as Record<string, unknown>) ?? {}));
      setDone(true);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Could not submit. Try again.";
      setSubmitError(message);
    }
  }`;
  const honeypotField = hosted
    ? `        <input
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
`
    : "";
  return `"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { stepSchemas, submissionSchema } from "./schema";

const spec = ${JSON.stringify(spec, null, 2)} as {
  title: string;
  description?: string;
  submitLabel: string;
  successMessage: string;
  steps: Array<{
    id: string;
    title: string;
    fields: Array<{
      id: string;
      type: string;
      label: string;
      description?: string;
      placeholder?: string;
      required: boolean;
      options?: Array<{ value: string; label: string }>;
      visibleWhen?: { fieldId: string; equals: string };
    }>;
  }>;
};
${submitBinding}const appearanceClassName = ${JSON.stringify(appearanceClassName(appearance))};
const appearanceStyle = ${JSON.stringify(appearanceStyle(appearance))};
const submitClassName = ${JSON.stringify(submitClassName(appearance))};
const appearanceTheme = ${JSON.stringify(appearance.theme)};

function parseNumberInput(raw: string): number | undefined {
  if (raw === "") {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

${componentSignature}
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);
${honeypotState}  const [submitError, setSubmitError] = useState("");
  const form = useForm({
    resolver: zodResolver(submissionSchema),
    defaultValues: {},
  });
  const watched = useWatch({ control: form.control });
  const step = spec.steps[stepIndex];
  if (!step) {
    return null;
  }

  function handleNext() {
    const parsed = stepSchemas[step.id as keyof typeof stepSchemas].safeParse(form.getValues());
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const name = String(issue.path[0] ?? step.id);
        form.setError(name, { message: issue.message });
      }
      return;
    }
    setStepIndex((current: number) => current + 1);
  }

${submitHandler}

  if (done) {
    return (
      <div className={appearanceClassName + " space-y-4 rounded-xl px-6 py-8 text-center"} style={appearanceStyle} data-formsquid-theme={appearanceTheme}>
        <p>{spec.successMessage}</p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className={appearanceClassName + " space-y-6 rounded-xl px-6 py-6"} style={appearanceStyle} data-formsquid-theme={appearanceTheme}>
        <div>
          <h1 className="text-2xl font-semibold">{spec.title}</h1>
          {spec.description ? <p className="text-muted-foreground">{spec.description}</p> : null}
        </div>
        <h2 className="text-lg font-medium">{step.title}</h2>
        {step.fields.map((field) => {
          if (field.visibleWhen && !conditionMet(spec, watched ?? {}, field)) {
            return null;
          }
          return (
            <FormField
              key={field.id}
              control={form.control}
              name={field.id}
              render={({ field: control }) => (
                <FormItem>
                  <FormLabel>{field.label}</FormLabel>
                  <FormControl>{renderControl(field, control)}</FormControl>
                  {field.description ? <FormDescription>{field.description}</FormDescription> : null}
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        })}
${honeypotField}        <div className="flex gap-2">
          {stepIndex > 0 ? (
            <Button type="button" variant="outline" onClick={() => setStepIndex((current: number) => current - 1)}>
              Back
            </Button>
          ) : null}
          {stepIndex < spec.steps.length - 1 ? (
            <Button type="button" className={submitClassName} onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button type="submit" className={submitClassName}>{spec.submitLabel}</Button>
          )}
        </div>
        {submitError ? <p role="alert">{submitError}</p> : null}
      </form>
    </Form>
  );
}

function conditionMet(formSpec: typeof spec, values: Record<string, unknown>, field: (typeof spec.steps)[number]["fields"][number]) {
  const rule = field.visibleWhen;
  if (!rule) {
    return true;
  }
  const parent = formSpec.steps.flatMap((item) => item.fields).find((item) => item.id === rule.fieldId);
  if (!parent) {
    return false;
  }
  const value = values[parent.id];
  if (parent.type === "checkbox") {
    return (value === true && rule.equals === "true") || (value === false && rule.equals === "false");
  }
  if (parent.type === "number") {
    return typeof value === "number" && JSON.stringify(value) === rule.equals;
  }
  return value === rule.equals;
}

function renderControl(field: (typeof spec.steps)[number]["fields"][number], control: { value?: unknown; onChange: (value: unknown) => void }) {
  if (field.type === "textarea") {
    return <Textarea placeholder={field.placeholder} value={String(control.value ?? "")} onChange={(event) => control.onChange(event.target.value)} />;
  }
  if (field.type === "select") {
    return (
      <Select items={field.options?.map((option) => ({ label: option.label, value: option.value }))} value={String(control.value ?? "")} onValueChange={control.onChange}>
        <SelectTrigger>
          <SelectValue placeholder={field.placeholder ?? "Select"} />
        </SelectTrigger>
        <SelectContent>
          {field.options?.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (field.type === "radio") {
    return (
      <RadioGroup value={String(control.value ?? "")} onValueChange={control.onChange}>
        {field.options?.map((option) => (
          <label key={option.value} className="flex items-center gap-2">
            <RadioGroupItem value={option.value} />
            {option.label}
          </label>
        ))}
      </RadioGroup>
    );
  }
  if (field.type === "checkbox") {
    return <Checkbox checked={Boolean(control.value)} onCheckedChange={(checked) => control.onChange(checked === true)} />;
  }
  return (
    <Input
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "email" ? "email" : "text"}
      placeholder={field.placeholder}
      value={field.type === "number" ? (typeof control.value === "number" && Number.isFinite(control.value) ? control.value : "") : String(control.value ?? "")}
      onChange={(event) =>
        control.onChange(field.type === "number" ? parseNumberInput(event.target.value) : event.target.value)
      }
    />
  );
}
`;
}

export function compileForm(input: FormSpec, target: CompileTarget): CompiledForm {
  const spec = formSpecSchema.parse(input);
  return {
    schemaSource: schemaSource(spec),
    formSource: formSource(spec, target),
    registryDependencies: registryDependencies(),
  };
}
