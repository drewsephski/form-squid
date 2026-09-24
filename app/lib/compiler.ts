import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
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

  return `import { z } from "zod";

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

function formSource(spec: FormSpec, submitUrl: string): string {
  return `"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
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

const spec = ${JSON.stringify(spec, null, 2)};
const submitUrl = ${JSON.stringify(submitUrl)};

export function ExportedForm() {
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const form = useForm({
    resolver: zodResolver(submissionSchema),
    defaultValues: {},
  });
  const step = spec.steps[stepIndex];
  if (!step) {
    return null;
  }

  function handleNext() {
    const parsed = stepSchemas[step.id].safeParse(form.getValues());
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const name = String(issue.path[0] ?? step.id);
        form.setError(name, { message: issue.message });
      }
      return;
    }
    setStepIndex((current) => current + 1);
  }

  async function handleSubmit(values: unknown) {
    if (honeypot) {
      setDone(true);
      return;
    }
    const response = await fetch(submitUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...((values as Record<string, unknown>) ?? {}), _gotcha: honeypot }),
    });
    if (response.ok) {
      setDone(true);
    }
  }

  if (done) {
    return <p>{spec.successMessage}</p>;
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{spec.title}</h1>
          {spec.description ? <p className="text-muted-foreground">{spec.description}</p> : null}
        </div>
        <h2 className="text-lg font-medium">{step.title}</h2>
        {step.fields.map((field) => {
          if (field.visibleWhen && !conditionMet(spec, form.getValues(), field)) {
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
        <input
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
        />
        <div className="flex gap-2">
          {stepIndex > 0 ? (
            <Button type="button" variant="outline" onClick={() => setStepIndex((current) => current - 1)}>
              Back
            </Button>
          ) : null}
          {stepIndex < spec.steps.length - 1 ? (
            <Button type="button" onClick={handleNext}>
              Next
            </Button>
          ) : (
            <Button type="submit">{spec.submitLabel}</Button>
          )}
        </div>
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
      <Select value={String(control.value ?? "")} onValueChange={control.onChange}>
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
      value={field.type === "number" ? (control.value as number | undefined) ?? "" : String(control.value ?? "")}
      onChange={(event) =>
        control.onChange(field.type === "number" ? event.target.valueAsNumber : event.target.value)
      }
    />
  );
}
`;
}

export function compileForm(input: FormSpec, submitUrl: string): CompiledForm {
  const spec = formSpecSchema.parse(input);
  return {
    schemaSource: schemaSource(spec),
    formSource: formSource(spec, submitUrl),
    registryDependencies: registryDependencies(),
  };
}
