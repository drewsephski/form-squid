"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fieldTypes, type FieldType, type FormSpec } from "@/app/lib/definitions";
import {
  addField,
  addOption,
  addStep,
  changeFieldType,
  deleteField,
  deleteStep,
  fieldTypeLabels,
  moveField,
  moveStep,
  removeOption,
  renameStep,
  updateField,
  updateOptionLabel,
} from "@/app/lib/edit-spec";

interface EditorInspectorProps {
  spec: FormSpec;
  slug: string;
  selectedId: string;
  onSpec: (spec: FormSpec) => void;
  onSlug: (slug: string) => void;
  onSelect: (fieldId: string) => void;
}

function apply(result: { spec: FormSpec } | { error: string }, onSpec: (spec: FormSpec) => void) {
  if ("error" in result) {
    toast.error(result.error);
    return null;
  }
  onSpec(result.spec);
  return result.spec;
}

export function FieldsInspector({ spec, selectedId, onSpec, onSelect }: EditorInspectorProps) {
  const selected = spec.steps.flatMap((step) => step.fields).find((field) => field.id === selectedId);
  const selectedStep = spec.steps.find((step) => step.fields.some((field) => field.id === selectedId)) ?? spec.steps.at(-1);

  if (selected) {
    const choice = selected.type === "select" || selected.type === "radio";
    return (
      <div className="space-y-4">
        <Button type="button" variant="ghost" className="px-0" onClick={() => onSelect("")}>
          Back to fields
        </Button>
        <div className="grid gap-2">
          <Label htmlFor="field-type">Type</Label>
          <Select
            value={selected.type}
            onValueChange={(value) => {
              if (value) {
                onSpec(changeFieldType(spec, selected.id, value as FieldType));
              }
            }}
          >
            <SelectTrigger id="field-type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fieldTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {fieldTypeLabels[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="field-label">Label</Label>
          <Input id="field-label" value={selected.label} onChange={(event) => onSpec(updateField(spec, selected.id, { label: event.target.value }))} />
        </div>
        {selected.type !== "checkbox" && selected.type !== "radio" ? (
          <div className="grid gap-2">
            <Label htmlFor="field-placeholder">Placeholder</Label>
            <Input
              id="field-placeholder"
              value={selected.placeholder ?? ""}
              onChange={(event) => onSpec(updateField(spec, selected.id, { placeholder: event.target.value || undefined }))}
            />
          </div>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="field-description">Description</Label>
          <Textarea
            id="field-description"
            value={selected.description ?? ""}
            onChange={(event) => onSpec(updateField(spec, selected.id, { description: event.target.value || undefined }))}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={selected.required} onCheckedChange={(checked) => onSpec(updateField(spec, selected.id, { required: checked === true }))} />
          Required
        </label>
        {choice ? (
          <div className="grid gap-2">
            <Label>Options</Label>
            {selected.options?.map((option, index) => (
              <div key={option.value} className="flex gap-2">
                <Input
                  aria-label={`Option ${index + 1}`}
                  value={option.label}
                  onChange={(event) => onSpec(updateOptionLabel(spec, selected.id, index, event.target.value))}
                />
                <Button type="button" variant="outline" aria-label={`Remove ${option.label}`} onClick={() => apply(removeOption(spec, selected.id, index), onSpec)}>
                  ×
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => onSpec(addOption(spec, selected.id))}>
              Add option
            </Button>
          </div>
        ) : null}
        <Button
          type="button"
          variant="destructive"
          onClick={() => {
            const next = apply(deleteField(spec, selected.id), onSpec);
            if (next) {
              onSelect("");
            }
          }}
        >
          Delete field
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {spec.steps.map((step) => (
        <div key={step.id} className="space-y-2">
          {spec.steps.length > 1 ? <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{step.title}</p> : null}
          {step.fields.map((field) => (
            <div key={field.id} className="flex items-center gap-2 rounded-lg border p-2">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(field.id)}>
                <span className="block truncate text-sm font-medium">{field.label}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {fieldTypeLabels[field.type]}
                  {field.required ? " · Required" : ""}
                </span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger aria-label={`${field.label} actions`} className="rounded-md px-2 py-1 text-sm hover:bg-muted">
                  •••
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onSpec(moveField(spec, field.id, -1))}>Move up</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSpec(moveField(spec, field.id, 1))}>Move down</DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => {
                      apply(deleteField(spec, field.id), onSpec);
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => {
          if (!selectedStep) {
            return;
          }
          const added = addField(spec, selectedStep.id);
          if ("error" in added) {
            toast.error(added.error);
            return;
          }
          onSpec(added.spec);
          onSelect(added.fieldId);
        }}
      >
        Add field
      </Button>
    </div>
  );
}

export function FormSettings({ spec, slug, onSpec, onSlug }: EditorInspectorProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="form-title">Form title</Label>
        <Input id="form-title" value={spec.title} onChange={(event) => onSpec({ ...spec, title: event.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="form-description">Description</Label>
        <Textarea id="form-description" value={spec.description ?? ""} onChange={(event) => onSpec({ ...spec, description: event.target.value || undefined })} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="submit-label">Submit button text</Label>
        <Input id="submit-label" value={spec.submitLabel} onChange={(event) => onSpec({ ...spec, submitLabel: event.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="success-message">Success message</Label>
        <Textarea id="success-message" value={spec.successMessage} onChange={(event) => onSpec({ ...spec, successMessage: event.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="slug">Address</Label>
        <Input id="slug" value={slug} onChange={(event) => onSlug(event.target.value)} />
        <p className="text-xs text-muted-foreground">The public address updates when this draft saves.</p>
      </div>
      <div className="space-y-2">
        {spec.steps.map((step, index) => (
          <div key={step.id} className="grid gap-2 rounded-lg border p-3">
            <Label htmlFor={`step-${step.id}`}>Step {index + 1}</Label>
            <Input id={`step-${step.id}`} value={step.title} onChange={(event) => onSpec(renameStep(spec, step.id, event.target.value))} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onSpec(moveStep(spec, step.id, -1))}>
                Up
              </Button>
              <Button type="button" variant="outline" onClick={() => onSpec(moveStep(spec, step.id, 1))}>
                Down
              </Button>
              <Button type="button" variant="outline" onClick={() => apply(deleteStep(spec, step.id), onSpec)}>
                Delete
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => {
            const added = addStep(spec);
            if ("error" in added) {
              toast.error(added.error);
              return;
            }
            onSpec(added.spec);
          }}
        >
          Add step
        </Button>
      </div>
    </div>
  );
}
