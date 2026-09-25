"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { FormField } from "@/app/lib/definitions";
import { acceptAttribute, fileFieldSettings, formatFileSize } from "@/app/lib/file-field";

export type UploadedFileValue = {
  uploadId: string;
  name: string;
  size: number;
  contentType: string;
};

type UploadContract =
  | { method: "PUT"; url: string; headers?: Record<string, string> }
  | { method: "POST"; url: string; fields: Record<string, string> };

interface FileFieldControlProps {
  field: FormField;
  id: string;
  uploadUrl?: string;
  /** When false, files stay local (callback / preview) as browser File objects. */
  hosted: boolean;
  value: UploadedFileValue | UploadedFileValue[] | File | File[] | undefined;
  error?: string;
  onChange: (value: UploadedFileValue | UploadedFileValue[] | File | File[] | undefined) => void;
}

function asList(value: FileFieldControlProps["value"]): Array<UploadedFileValue | File> {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function isUploaded(value: UploadedFileValue | File): value is UploadedFileValue {
  return "uploadId" in value;
}

async function authorizeAndUpload(input: {
  uploadUrl: string;
  fieldId: string;
  file: File;
}): Promise<UploadedFileValue> {
  const authorize = await fetch(input.uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fieldId: input.fieldId,
      filename: input.file.name,
      contentType: input.file.type || "application/octet-stream",
      size: input.file.size,
    }),
  });
  const body = (await authorize.json().catch(() => null)) as
    | { ok: true; uploadId: string; upload: UploadContract }
    | { ok: false; error?: string }
    | null;
  if (!authorize.ok || !body || !("uploadId" in body)) {
    throw new Error(body && "error" in body && body.error ? body.error : "Could not start upload.");
  }

  if (body.upload.method === "PUT") {
    const response = await fetch(body.upload.url, {
      method: "PUT",
      headers: {
        ...(body.upload.headers ?? {}),
        "Content-Type": input.file.type || "application/octet-stream",
      },
      body: input.file,
    });
    if (!response.ok) {
      throw new Error("Upload failed. Try again.");
    }
  } else {
    const form = new FormData();
    for (const [key, value] of Object.entries(body.upload.fields)) {
      form.append(key, value);
    }
    form.append("file", input.file);
    const response = await fetch(body.upload.url, { method: "POST", body: form });
    if (!response.ok) {
      throw new Error("Upload failed. Try again.");
    }
  }

  return {
    uploadId: body.uploadId,
    name: input.file.name,
    size: input.file.size,
    contentType: input.file.type || "application/octet-stream",
  };
}

export function FileFieldControl({
  field,
  id,
  uploadUrl,
  hosted,
  value,
  error,
  onChange,
}: FileFieldControlProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [localError, setLocalError] = useState("");
  const settings = fileFieldSettings(field);
  const files = asList(value);
  const displayError = localError || error;

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) {
      return;
    }
    setLocalError("");
    const selected = Array.from(list).slice(0, settings.maxFiles);
    if (hosted) {
      if (!uploadUrl) {
        setLocalError("Uploads are unavailable.");
        return;
      }
      setPending(true);
      try {
        const uploaded: UploadedFileValue[] = [];
        for (const file of selected) {
          uploaded.push(await authorizeAndUpload({ uploadUrl, fieldId: field.id, file }));
        }
        onChange(settings.maxFiles === 1 ? uploaded[0] : uploaded);
      } catch (uploadError) {
        setLocalError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
      } finally {
        setPending(false);
        if (inputRef.current) {
          inputRef.current.value = "";
        }
      }
      return;
    }

    onChange(settings.maxFiles === 1 ? selected[0] : selected);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleRemove(index: number) {
    const next = files.filter((_, itemIndex) => itemIndex !== index);
    if (next.length === 0) {
      onChange(undefined);
      return;
    }
    onChange(settings.maxFiles === 1 ? next[0] : (next as UploadedFileValue[] | File[]));
  }

  return (
    <div className="space-y-2">
      <Input
        ref={inputRef}
        id={id}
        type="file"
        accept={acceptAttribute(settings.accept)}
        multiple={settings.maxFiles > 1}
        disabled={pending}
        aria-invalid={Boolean(displayError)}
        aria-required={field.required}
        aria-label={field.label}
        onChange={(event) => {
          void handleFiles(event.target.files);
        }}
      />
      {pending ? <p className="text-sm text-muted-foreground">Uploading…</p> : null}
      {files.length > 0 ? (
        <ul className="space-y-1">
          {files.map((file, index) => {
            const name = isUploaded(file) ? file.name : file.name;
            const size = isUploaded(file) ? file.size : file.size;
            return (
              <li key={`${name}-${index}`} className="flex items-center justify-between gap-2 text-sm">
                <span className="min-w-0 truncate">
                  {name} · {formatFileSize(size)}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => handleRemove(index)} aria-label={`Remove ${name}`}>
                  Remove
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
      {displayError ? <p className="text-sm text-destructive">{displayError}</p> : null}
    </div>
  );
}

export function submissionValueFromFiles(value: FileFieldControlProps["value"]) {
  const files = asList(value);
  if (files.length === 0) {
    return undefined;
  }
  if (files.every(isUploaded)) {
    return files.length === 1 ? files[0]!.uploadId : files.map((file) => file.uploadId);
  }
  return files.length === 1 ? files[0] : files;
}
