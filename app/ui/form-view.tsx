"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { honeypotField, type FormField, type FormSpec, type SubmissionData } from "@/app/lib/definitions";
import { fieldIsVisible } from "@/app/lib/submission-algorithm";
import { validateSubmission } from "@/app/lib/validate-submission";

interface FormViewProps {
  spec: FormSpec;
  submitUrl?: string;
  preview?: boolean;
}

export function FormView({ spec, submitUrl, preview = false }: FormViewProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string | number | boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState("");
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const step = spec.steps[stepIndex];

  if (!step) {
    return null;
  }

  function handleValue(id: string, value: string | number | boolean) {
    setValues((current) => ({ ...current, [id]: value }));
  }

  function visible(field: FormField) {
    return fieldIsVisible(spec, values, field);
  }

  function handleNext() {
    const result = validateSubmission(spec, values, { stepId: step.id });
    if (!result.ok) {
      setErrors(Object.fromEntries(result.errors.filter((error) => error.path).map((error) => [error.path, error.message])));
      return;
    }
    setErrors({});
    setStepIndex((current) => current + 1);
  }

  async function handleSubmit() {
    const result = validateSubmission(spec, values);
    if (!result.ok) {
      setErrors(Object.fromEntries(result.errors.filter((error) => error.path).map((error) => [error.path, error.message])));
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
    const response = await fetch(submitUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...result.data, [honeypotField]: honeypot }),
    });
    setPending(false);
    if (response.ok) {
      setDone(true);
    }
  }

  if (done) {
    return <p className="text-lg">{spec.successMessage}</p>;
  }

  return (
    <form
      className="space-y-6"
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
      <h2 className="text-lg font-medium">{step.title}</h2>
      {step.fields.filter(visible).map((field) => (
        <FieldControl
          key={field.id}
          field={field}
          value={values[field.id]}
          error={errors[field.id]}
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
          <Button type="button" variant="outline" onClick={() => setStepIndex((current) => current - 1)}>
            Back
          </Button>
        ) : null}
        <Button type="submit" disabled={pending}>
          {stepIndex < spec.steps.length - 1 ? "Next" : spec.submitLabel}
        </Button>
      </div>
    </form>
  );
}

interface FieldControlProps {
  field: FormField;
  value: SubmissionData[string] | undefined;
  error?: string;
  onChange: (value: string | number | boolean) => void;
}

function FieldControl({ field, value, error, onChange }: FieldControlProps) {
  const id = `field-${field.id}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{field.label}</Label>
      {field.type === "textarea" ? (
        <Textarea id={id} placeholder={field.placeholder} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} aria-invalid={Boolean(error)} />
      ) : null}
      {field.type === "select" ? (
        <Select value={typeof value === "string" ? value : undefined} onValueChange={(next) => { if (next) onChange(next); }}>
          <SelectTrigger id={id} aria-invalid={Boolean(error)}>
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
        <Checkbox id={id} checked={value === true} onCheckedChange={(checked) => onChange(checked === true)} aria-invalid={Boolean(error)} />
      ) : null}
      {field.type === "text" || field.type === "email" || field.type === "number" || field.type === "date" ? (
        <Input
          id={id}
          type={field.type === "text" ? "text" : field.type}
          placeholder={field.placeholder}
          value={value === undefined ? "" : String(value)}
          aria-invalid={Boolean(error)}
          onChange={(event) => onChange(field.type === "number" ? event.target.valueAsNumber : event.target.value)}
        />
      ) : null}
      {field.description ? <p className="text-sm text-muted-foreground">{field.description}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
