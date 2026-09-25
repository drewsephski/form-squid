import type { FormField, SubmissionFileRef } from "./definitions";
import { fileFieldSettings } from "./file-field";

export function sampleFileRef(field: FormField): SubmissionFileRef | SubmissionFileRef[] {
  const settings = fileFieldSettings(field);
  const ref: SubmissionFileRef = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "example.pdf",
    contentType: "application/pdf",
    size: 12_345,
  };
  return settings.maxFiles === 1
    ? ref
    : [ref, { ...ref, id: "00000000-0000-4000-8000-000000000002", name: "example-2.pdf" }];
}
