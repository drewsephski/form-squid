"use client";

import { useState, type ReactNode } from "react";
import { AnimateHeight } from "@/components/ui/animate-height";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { appearanceClassName, appearanceStyle, resolveAppearance, submitClassName, submitSlotClassName } from "@/app/lib/appearance";
import { honeypotField, type FormField, type FormSpec, type SubmissionValue } from "@/app/lib/definitions";
import { parseNumberInput } from "@/app/lib/number-input";
import { fieldIsVisible } from "@/app/lib/submission-algorithm";
import { validateSubmission } from "@/app/lib/validate-submission";
import { FileFieldControl, submissionValueFromFiles, type UploadedFileValue } from "@/app/ui/file-field-control";

interface FormViewProps {
  spec: FormSpec;
  submitUrl?: string;
  uploadUrl?: string;
  preview?: boolean;
  /** Tighter padding/spacing for thumbnail card previews. */
  compact?: boolean;
  /** Prefix field element ids when multiple forms render on one page. */
  idPrefix?: string;
}

type FormValue = SubmissionValue | UploadedFileValue | UploadedFileValue[] | File | File[];

export function FormView({ spec, submitUrl, uploadUrl, preview = false, compact = false, idPrefix = "" }: FormViewProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<Record<string, FormValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const step = spec.steps[stepIndex];
  const appearance = resolveAppearance(spec);
  const frameClass = appearanceClassName(appearance);
  const frameStyle = appearanceStyle(appearance);
  const actionClass = submitClassName(appearance);
  const actionSlotClass = submitSlotClassName(appearance);

  if (!step) {
    return null;
  }

  function payloadFromValues() {
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(values)) {
      const field = spec.steps.flatMap((item) => item.fields).find((item) => item.id === key);
      if (field?.type === "file") {
        const next = submissionValueFromFiles(value as UploadedFileValue | UploadedFileValue[] | File | File[] | undefined);
        if (next !== undefined) {
          payload[key] = next;
        }
        continue;
      }
      payload[key] = value;
    }
    return payload;
  }

  function handleValue(id: string, value: FormValue | undefined) {
    setValues((current) => {
      if (value === undefined) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      return { ...current, [id]: value };
    });
    setErrors((current) => {
      if (!current[id]) {
        return current;
      }
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function showErrors(next: Record<string, string>) {
    setErrors(next);
    const fieldId = Object.keys(next)[0];
    if (!fieldId) {
      return;
    }
    const node = document.querySelector(`[data-field="${fieldId}"]`);
    const focusable = node?.querySelector("input, textarea, button");
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (focusable instanceof HTMLElement) {
      focusable.focus();
    }
  }

  function visible(field: FormField) {
    return fieldIsVisible(spec, values, field);
  }

  function handleNext() {
    const result = validateSubmission(spec, payloadFromValues(), { stepId: step.id });
    if (!result.ok) {
      showErrors(Object.fromEntries(result.errors.filter((error) => error.path).map((error) => [error.path, error.message])));
      return;
    }
    setErrors({});
    setStepIndex((current) => current + 1);
  }

  async function handleSubmit() {
    const result = validateSubmission(spec, payloadFromValues());
    if (!result.ok) {
      showErrors(Object.fromEntries(result.errors.filter((error) => error.path).map((error) => [error.path, error.message])));
      return;
    }
    if (preview || honeypot) {
      setDone(true);
      return;
    }
    if (!submitUrl) {
      setDone(true);
      return;
    }
    setPending(true);
    setSubmitError("");
    try {
      const response = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...result.data, [honeypotField]: honeypot }),
      });
      if (response.ok) {
        setDone(true);
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      setSubmitError(typeof body?.error === "string" ? body.error : "Could not submit. Try again.");
    } catch {
      setSubmitError("Could not submit. Try again.");
    } finally {
      setPending(false);
    }
  }

  const progress = ((stepIndex + 1) / spec.steps.length) * 100;

  let body: ReactNode;
  if (done && preview) {
    body = (
      <div className={`${frameClass} space-y-4 rounded-xl px-6 py-8 text-center`} style={frameStyle} data-formsquid-theme={appearance.theme} role="status">
        <p className="text-lg">Save and publish first to receive feedback.</p>
        <p className="text-sm text-muted-foreground">This is a preview. Submissions are collected after you publish the form.</p>
      </div>
    );
  } else if (done) {
    body = (
      <div className={`${frameClass} space-y-4 rounded-xl px-6 py-8 text-center`} style={frameStyle} data-formsquid-theme={appearance.theme}>
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/15 text-lg text-primary" aria-hidden="true">
          ✓
        </div>
        <p className="text-lg">{spec.successMessage}</p>
        <p className="text-sm text-muted-foreground">
          Made with{" "}
          <a className="underline underline-offset-4" href="https://formsquid.com">
            FormSquid
          </a>
        </p>
      </div>
    );
  } else {
    body = (
      <form
        className={`${frameClass} rounded-xl ${compact ? "space-y-4 px-4 py-4" : "space-y-6 px-6 py-6"}`}
        style={frameStyle}
        data-formsquid-theme={appearance.theme}
        onSubmit={(event) => {
          event.preventDefault();
          if (stepIndex < spec.steps.length - 1) {
            handleNext();
            return;
          }
          void handleSubmit();
        }}
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{spec.title}</h1>
          {spec.description ? <p className="text-muted-foreground">{spec.description}</p> : null}
        </div>
        {spec.steps.length > 1 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Step {stepIndex + 1} of {spec.steps.length}
            </p>
            <h2 className="text-lg font-medium">{step.title}</h2>
            <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full bg-foreground transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <h2 className="text-lg font-medium">{step.title}</h2>
        )}
        {step.fields.filter(visible).map((field) => (
          <FieldControl
            key={field.id}
            field={field}
            idPrefix={idPrefix}
            value={values[field.id]}
            error={errors[field.id]}
            uploadUrl={uploadUrl}
            hosted={Boolean(submitUrl) && !preview}
            onChange={(value) => handleValue(field.id, value)}
          />
        ))}
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
            <Button type="button" variant="outline" className="shrink-0" onClick={() => setStepIndex((current) => current - 1)}>
              Back
            </Button>
          ) : null}
          <div className={actionSlotClass}>
            <Button type="submit" className={actionClass} disabled={pending}>
              {pending ? "Sending…" : stepIndex < spec.steps.length - 1 ? "Next" : spec.submitLabel}
            </Button>
          </div>
        </div>
        {submitError ? <p role="alert" className="text-sm text-destructive">{submitError}</p> : null}
      </form>
    );
  }

  if (compact) {
    return body;
  }

  return <AnimateHeight>{body}</AnimateHeight>;
}

interface FieldControlProps {
  field: FormField;
  idPrefix?: string;
  value: FormValue | undefined;
  error?: string;
  uploadUrl?: string;
  hosted: boolean;
  onChange: (value: FormValue | undefined) => void;
}

function FieldControl({ field, idPrefix = "", value, error, uploadUrl, hosted, onChange }: FieldControlProps) {
  const id = `${idPrefix}field-${field.id}`;
  return (
    <div className="grid gap-2" data-field={field.id}>
      <Label htmlFor={id}>
        {field.label}
        {field.required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {field.type === "file" ? (
        <FileFieldControl
          field={field}
          id={id}
          uploadUrl={uploadUrl}
          hosted={hosted}
          value={value as UploadedFileValue | UploadedFileValue[] | File | File[] | undefined}
          error={error}
          onChange={onChange}
        />
      ) : null}
      {field.type === "textarea" ? (
        <Textarea id={id} placeholder={field.placeholder} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} aria-required={field.required} />
      ) : null}
      {field.type === "select" ? (
        <Select
          items={(field.options ?? []).map((option) => ({ value: option.value, label: option.label }))}
          value={typeof value === "string" ? value : undefined}
          onValueChange={(next) => { if (next) onChange(next); }}
        >
          <SelectTrigger id={id} aria-invalid={Boolean(error)} aria-required={field.required}>
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
      ) : null}
      {field.type === "radio" ? (
        <RadioGroup value={typeof value === "string" ? value : undefined} onValueChange={onChange}>
          {field.options?.map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <RadioGroupItem id={`${id}-${option.value}`} value={option.value} />
              <Label htmlFor={`${id}-${option.value}`}>{option.label}</Label>
            </div>
          ))}
        </RadioGroup>
      ) : null}
      {field.type === "checkbox" ? (
        <Checkbox id={id} checked={value === true} onCheckedChange={(checked) => onChange(checked === true)} aria-invalid={Boolean(error)} aria-required={field.required} />
      ) : null}
      {field.type === "date" ? (
        <DatePicker
          id={id}
          value={typeof value === "string" ? value : undefined}
          placeholder={field.placeholder ?? "Pick a date"}
          aria-invalid={Boolean(error)}
          aria-required={field.required}
          onChange={(next) => onChange(next)}
        />
      ) : null}
      {field.type === "text" || field.type === "email" || field.type === "number" ? (
        <Input
          id={id}
          type={field.type === "text" ? "text" : field.type}
          placeholder={field.placeholder}
          value={typeof value === "number" ? (Number.isFinite(value) ? value : "") : value === undefined ? "" : String(value)}
          aria-invalid={Boolean(error)}
          aria-required={field.required}
          onChange={(event) => onChange(field.type === "number" ? parseNumberInput(event.target.value) : event.target.value)}
        />
      ) : null}
      {field.description ? <p className="text-sm text-muted-foreground">{field.description}</p> : null}
      {field.type !== "file" && error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
