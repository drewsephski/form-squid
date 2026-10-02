import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { appearanceClassName, appearanceStyle, resolveAppearance, submitClassName, submitSlotClassName } from "./appearance";
import { formSpecSchema, type FormSpec } from "./definitions";
import { exportedFileFieldSource } from "./exported-file-field";

export type CompiledForm = {
  schemaSource: string;
  formSource: string;
  registryDependencies: string[];
};

function embeddedAlgorithm(): string {
  const files = ["upload-limits.ts", "file-field.ts", "submission-algorithm.ts"];

  return files
    .map((file) => {
      const source = readFileSync(path.join(process.cwd(), "app/lib", file), "utf8");
      const javascript = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: file,
      }).outputText;
      const parsed = ts.createSourceFile(file, javascript, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
      const imports = parsed.statements.filter(ts.isImportDeclaration).map((declaration) => ({
        start: declaration.getStart(parsed),
        end: declaration.end,
      }));
      let selfContained = javascript;
      for (const declaration of imports.reverse()) {
        selfContained = `${selfContained.slice(0, declaration.start)}${selfContained.slice(declaration.end)}`;
      }

      return selfContained.replace(/^export /gm, "").trim();
    })
    .join("\n\n");
}

function registryDependencies(): string[] {
  return ["button", "calendar", "checkbox", "form", "input", "label", "popover", "radio-group", "select", "textarea"];
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

function normalizeUploadedFileValues(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const record = { ...value };
  const fileFields = spec.steps.flatMap((step) => step.fields).filter((field) => field.type === "file");
  for (const field of fileFields) {
    const current = record[field.id];
    const isUploadedFileValue = (item) => Boolean(
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      isUploadId(item.uploadId) &&
      typeof item.name === "string" &&
      typeof item.size === "number" &&
      Number.isFinite(item.size) &&
      typeof item.contentType === "string",
    );
    if (isUploadedFileValue(current)) {
      record[field.id] = current.uploadId;
    } else if (Array.isArray(current) && current.every(isUploadedFileValue)) {
      record[field.id] = current.map((item) => item.uploadId);
    }
  }
  return record;
}

function createSchema(stepId) {
  return z.any().superRefine((value, context) => {
    const result = validatePayload(spec, normalizeUploadedFileValues(value), stepId);
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
    const result = validatePayload(spec, normalizeUploadedFileValues(value), stepId);
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
  | { submission: "formsquid"; url: string; uploadUrl: string }
  | { submission: "callback" };

function formSource(spec: FormSpec, target: CompileTarget): string {
  const appearance = resolveAppearance(spec);
  const hosted = target.submission === "formsquid";
  const submitBinding = hosted
    ? `const submitUrl = ${JSON.stringify(target.url)};\nconst uploadUrl = ${JSON.stringify(target.uploadUrl)};\n`
    : "";
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
    if (sendingRef.current) return;
    if (pendingUploadCountRef.current > 0) {
      setSubmitError("Wait for the file upload to finish before submitting.");
      return;
    }
    if (uploadIssueCountRef.current > 0) {
      setSubmitError("Retry or remove the file with an upload error before submitting.");
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setSubmitError("");
    try {
      if (honeypot) {
        setDone(true);
        return;
      }
      const payload = serializeSubmission(values);
      const response = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, _gotcha: honeypot }),
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
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }`
    : `  async function handleSubmit(values: unknown) {
    if (sendingRef.current) return;
    if (pendingUploadCountRef.current > 0) {
      setSubmitError("Wait for the file upload to finish before submitting.");
      return;
    }
    if (uploadIssueCountRef.current > 0) {
      setSubmitError("Retry or remove the file with an upload error before submitting.");
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setSubmitError("");
    try {
      await onSubmit(((values as Record<string, unknown>) ?? {}));
      setDone(true);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Could not submit. Try again.";
      setSubmitError(message);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }`;
  const fileFieldSource = exportedFileFieldSource(hosted);  const honeypotField = hosted
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

import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
      maxFiles?: 1 | 5;
      maxFileSizeMb?: number;
      accept?: string[];
    }>;
  }>;
};
${submitBinding}const appearanceClassName = ${JSON.stringify(appearanceClassName(appearance))};
const appearanceStyle = ${JSON.stringify(appearanceStyle(appearance))};
const submitClassName = ${JSON.stringify(submitClassName(appearance))};
const submitSlotClassName = ${JSON.stringify(submitSlotClassName(appearance))};
const appearanceTheme = ${JSON.stringify(appearance.theme)};

function parseNumberInput(raw: string): number | undefined {
  if (raw === "") {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function parseIsoDate(value: string): Date | undefined {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) {
    return undefined;
  }
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return undefined;
  }
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return undefined;
  }
  return date;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return \`\${year}-\${month}-\${day}\`;
}

function DateField({
  value,
  onChange,
  placeholder,
}: {
  value?: unknown;
  onChange: (value: unknown) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const date = typeof value === "string" ? parseIsoDate(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            data-empty={!date}
            className="w-full justify-between font-normal data-[empty=true]:text-muted-foreground"
          />
        }
      >
        {date ? format(date, "PPP") : <span>{placeholder ?? "Pick a date"}</span>}
        <ChevronDownIcon data-icon="inline-end" />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          defaultMonth={date}
          onSelect={(next) => {
            onChange(next ? toIsoDate(next) : undefined);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

${componentSignature}
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const [uploadIssueCount, setUploadIssueCount] = useState(0);
  const pendingUploadCountRef = useRef(0);
  const uploadIssueCountRef = useRef(0);
  const uploadStates = useRef(new Map<string, { pending: boolean; error: boolean }>());
  const sendingRef = useRef(false);
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

  function handleUploadStateChange(fieldId: string, state: { pending: boolean; error: boolean }) {
    uploadStates.current.set(fieldId, state);
    pendingUploadCountRef.current = [...uploadStates.current.values()].filter((upload) => upload.pending).length;
    uploadIssueCountRef.current = [...uploadStates.current.values()].filter((upload) => upload.error).length;
    setPendingUploadCount(pendingUploadCountRef.current);
    setUploadIssueCount(uploadIssueCountRef.current);
  }

  function handleFieldChange(fieldId: string, value: unknown, onChange: (value: unknown) => void) {
    if (sendingRef.current || pendingUploadCountRef.current > 0) return;
    onChange(value);
    const values = { ...(form.getValues() as Record<string, unknown>), [fieldId]: value };
    for (const [uploadFieldId, state] of uploadStates.current) {
      if (!state.error) continue;
      const uploadField = spec.steps.flatMap((item) => item.fields).find((item) => item.id === uploadFieldId);
      if (!uploadField || !conditionMet(spec, values, uploadField)) {
        handleUploadStateChange(uploadFieldId, { pending: false, error: false });
      }
    }
  }

  function handleNext() {
    if (pendingUploadCountRef.current > 0) {
      setSubmitError("Wait for the file upload to finish before continuing.");
      return;
    }
    if (uploadIssueCountRef.current > 0) {
      setSubmitError("Retry or remove the file with an upload error before continuing.");
      return;
    }
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
        <fieldset disabled={sending || pendingUploadCount > 0} className="min-w-0 space-y-6 border-0 p-0">
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
                  <FormControl>{renderControl(field, { value: control.value, onChange: (value) => handleFieldChange(field.id, value, control.onChange) }, handleUploadStateChange, sending || pendingUploadCount > 0)}</FormControl>
                  {field.description ? <FormDescription>{field.description}</FormDescription> : null}
                  <FormMessage />
                </FormItem>
              )}
            />
          );
        })}
        </fieldset>
${honeypotField}        <div className="flex gap-2">
          {stepIndex > 0 ? (
              <Button type="button" variant="outline" className="shrink-0" disabled={sending || pendingUploadCount > 0 || uploadIssueCount > 0} onClick={() => setStepIndex((current: number) => current - 1)}>
              Back
            </Button>
          ) : null}
          <div className={submitSlotClassName}>
            {stepIndex < spec.steps.length - 1 ? (
            <Button type="button" className={submitClassName} disabled={sending || pendingUploadCount > 0 || uploadIssueCount > 0} onClick={handleNext}>
              {pendingUploadCount > 0 ? "Uploading…" : uploadIssueCount > 0 ? "Fix file upload" : "Next"}
            </Button>
          ) : (
            <Button type="submit" className={submitClassName} disabled={sending || pendingUploadCount > 0 || uploadIssueCount > 0}>{sending ? "Sending…" : pendingUploadCount > 0 ? "Uploading…" : uploadIssueCount > 0 ? "Fix file upload" : spec.submitLabel}</Button>
            )}
          </div>
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

${fileFieldSource}

function renderControl(field: (typeof spec.steps)[number]["fields"][number], control: { value?: unknown; onChange: (value: unknown) => void }, onUploadStateChange: (fieldId: string, state: { pending: boolean; error: boolean }) => void, disabled: boolean) {
  if (field.type === "file") {
    return <FileField field={field} value={control.value} onChange={control.onChange} onUploadStateChange={onUploadStateChange} disabled={disabled} />;
  }
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
  if (field.type === "date") {
    return <DateField value={control.value} onChange={control.onChange} placeholder={field.placeholder} />;
  }
  return (
    <Input
      type={field.type === "number" ? "number" : field.type === "email" ? "email" : "text"}
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
