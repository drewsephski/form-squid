"use client";

import { useRef, useState, type ReactNode } from "react";
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
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const [uploadIssueCount, setUploadIssueCount] = useState(0);
  const pendingUploadFields = useRef(new Set<string>());
  const uploadIssueFields = useRef(new Set<string>());
  const submissionLock = useRef(false);
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
    if (submissionLock.current || pendingUploadFields.current.size > 0) {
      return;
    }
    const nextValues = { ...values };
    if (value === undefined) {
      delete nextValues[id];
    } else {
      nextValues[id] = value;
    }
    setValues(nextValues);
    for (const fieldId of uploadIssueFields.current) {
      const field = spec.steps.flatMap((item) => item.fields).find((item) => item.id === fieldId);
      if (field && !fieldIsVisible(spec, nextValues, field)) {
        uploadIssueFields.current.delete(fieldId);
      }
    }
    setUploadIssueCount(uploadIssueFields.current.size);
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
    if (pendingUploadFields.current.size > 0) {
      setSubmitError("Wait for the file upload to finish before continuing.");
      return;
    }
    if (uploadIssueFields.current.size > 0) {
      setSubmitError("Retry or remove the file with an upload error before continuing.");
      return;
    }
    const result = validateSubmission(spec, payloadFromValues(), { stepId: step.id });
    if (!result.ok) {
      showErrors(Object.fromEntries(result.errors.filter((error) => error.path).map((error) => [error.path, error.message])));
      return;
    }
    setErrors({});
    setStepIndex((current) => current + 1);
  }

  async function handleSubmit() {
    if (submissionLock.current) {
      return;
    }
    if (pendingUploadFields.current.size > 0) {
      setSubmitError("Wait for the file upload to finish before submitting.");
      return;
    }
    if (uploadIssueFields.current.size > 0) {
      setSubmitError("Retry or remove the file with an upload error before submitting.");
      return;
    }
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
    submissionLock.current = true;
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
      submissionLock.current = false;
      setPending(false);
    }
  }

  function handleUploadStateChange(fieldId: string, state: { pending: boolean; error: boolean }) {
    if (state.pending) {
      pendingUploadFields.current.add(fieldId);
    } else {
      pendingUploadFields.current.delete(fieldId);
    }
    if (state.error) {
      uploadIssueFields.current.add(fieldId);
    } else {
      uploadIssueFields.current.delete(fieldId);
    }
    setPendingUploadCount(pendingUploadFields.current.size);
    setUploadIssueCount(uploadIssueFields.current.size);
    setSubmitError("");
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
            disabled={pending || pendingUploadCount > 0}
            onUploadStateChange={handleUploadStateChange}
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
            <Button type="button" variant="outline" className="shrink-0" disabled={pending || pendingUploadCount > 0 || uploadIssueCount > 0} onClick={() => setStepIndex((current) => current - 1)}>
              Back
            </Button>
          ) : null}
          <div className={actionSlotClass}>
            <Button type="submit" className={actionClass} disabled={pending || pendingUploadCount > 0 || uploadIssueCount > 0}>
              {pending ? "Sending…" : pendingUploadCount > 0 ? "Uploading…" : uploadIssueCount > 0 ? "Fix file upload" : stepIndex < spec.steps.length - 1 ? "Next" : spec.submitLabel}
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
  disabled: boolean;
  onUploadStateChange: (fieldId: string, state: { pending: boolean; error: boolean }) => void;
  onChange: (value: FormValue | undefined) => void;
}

function FieldControl({ field, idPrefix = "", value, error, uploadUrl, hosted, disabled, onUploadStateChange, onChange }: FieldControlProps) {
  const id = `${idPrefix}field-${field.id}`;
  const errorId = `${id}-error`;
  const descriptionId = field.description ? `${id}-description` : undefined;
  const describedBy = [descriptionId, error ? errorId : undefined].filter(Boolean).join(" ") || undefined;
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
          disabled={disabled}
          describedBy={describedBy}
          onUploadStateChange={onUploadStateChange}
          value={value as UploadedFileValue | UploadedFileValue[] | File | File[] | undefined}
          error={error}
          onChange={onChange}
        />
      ) : null}
      {field.type === "textarea" ? (
        <Textarea id={id} placeholder={field.placeholder} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} disabled={disabled} aria-invalid={Boolean(error)} aria-required={field.required} aria-describedby={describedBy} />
      ) : null}
      {field.type === "select" ? (
        <Select
          items={(field.options ?? []).map((option) => ({ value: option.value, label: option.label }))}
          value={typeof value === "string" ? value : undefined}
          onValueChange={(next) => { if (next) onChange(next); }}
        >
          <SelectTrigger id={id} disabled={disabled} aria-invalid={Boolean(error)} aria-required={field.required} aria-describedby={describedBy}>
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
        <RadioGroup value={typeof value === "string" ? value : undefined} onValueChange={onChange} disabled={disabled} aria-invalid={Boolean(error)} aria-required={field.required} aria-describedby={describedBy}>
          {field.options?.map((option) => (
            <div key={option.value} className="flex items-center gap-2">
              <RadioGroupItem id={`${id}-${option.value}`} value={option.value} />
              <Label htmlFor={`${id}-${option.value}`}>{option.label}</Label>
            </div>
          ))}
        </RadioGroup>
      ) : null}
      {field.type === "checkbox" ? (
        <Checkbox id={id} checked={value === true} disabled={disabled} onCheckedChange={(checked) => onChange(checked === true)} aria-invalid={Boolean(error)} aria-required={field.required} aria-describedby={describedBy} />
      ) : null}
      {field.type === "date" ? (
        <DatePicker
          id={id}
          value={typeof value === "string" ? value : undefined}
          placeholder={field.placeholder ?? "Pick a date"}
          aria-invalid={Boolean(error)}
          aria-required={field.required}
          aria-describedby={describedBy}
          disabled={disabled}
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
          aria-describedby={describedBy}
          disabled={disabled}
          onChange={(event) => onChange(field.type === "number" ? parseNumberInput(event.target.value) : event.target.value)}
        />
      ) : null}
      {field.description ? <p id={descriptionId} className="text-sm text-muted-foreground">{field.description}</p> : null}
      {field.type !== "file" && error ? <p id={errorId} role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
