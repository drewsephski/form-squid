export function exportedFileFieldSource(hosted: boolean) {
  if (!hosted) {
    return `
function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(bytes < 10485760 ? 1 : 0) + " MB";
}

function FileField({
  field,
  value,
  onChange,
  onUploadStateChange,
  disabled,
}: {
  field: (typeof spec.steps)[number]["fields"][number];
  value?: unknown;
  onChange: (value: unknown) => void;
  onUploadStateChange: (fieldId: string, state: { pending: boolean; error: boolean }) => void;
  disabled: boolean;
}) {
  const [error, setError] = useState("");
  const maxFiles = field.maxFiles === 5 ? 5 : 1;
  const accept = Array.isArray(field.accept) && field.accept.length > 0 ? field.accept.join(",") : undefined;
  const files = Array.isArray(value) ? value : value ? [value] : [];

  function handleChange(list: FileList | null) {
    if (disabled || !list || list.length === 0) return;
    if (list.length > maxFiles) {
      const message = maxFiles === 1 ? "Choose one file." : "Choose up to " + maxFiles + " files.";
      setError(message);
      onUploadStateChange(field.id, { pending: false, error: true });
      return;
    }
    setError("");
    onUploadStateChange(field.id, { pending: false, error: false });
    const selected = Array.from(list);
    onChange(maxFiles === 1 ? selected[0] : selected);
  }

  return (
    <div className="space-y-2">
      <Input id={"field-" + field.id} type="file" accept={accept} multiple={maxFiles > 1} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={error ? field.id + "-upload-error" : undefined} onChange={(event) => { handleChange(event.target.files); event.target.value = ""; }} />
      {files.map((file: { name: string; size: number }, index: number) => (
        <div key={index} className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate">{file.name} · {formatBytes(file.size)}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => {
              const next = files.filter((_: unknown, itemIndex: number) => itemIndex !== index);
              setError("");
              onUploadStateChange(field.id, { pending: false, error: false });
              onChange(next.length === 0 ? undefined : maxFiles === 1 ? next[0] : next);
            }}
          >
            Remove
          </Button>
        </div>
      ))}
      {error ? <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => { onChange(undefined); setError(""); onUploadStateChange(field.id, { pending: false, error: false }); }}>Clear file selection</Button> : null}
      {error ? <p id={field.id + "-upload-error"} role="alert" className="text-sm text-destructive">{error}</p> : null}
      <p className="text-xs text-muted-foreground">Files are passed to onSubmit as browser File objects. FormSquid does not upload them in callback mode.</p>
    </div>
  );
}
`;
  }

  return `
function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(bytes < 10240 ? 1 : 0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(bytes < 10485760 ? 1 : 0) + " MB";
}

function serializeSubmission(values: unknown) {
  const record = values && typeof values === "object" && !Array.isArray(values) ? { ...(values as Record<string, unknown>) } : {};
  for (const [key, value] of Object.entries(record)) {
    if (value && typeof value === "object" && !Array.isArray(value) && "uploadId" in value && typeof (value as { uploadId?: unknown }).uploadId === "string") {
      record[key] = (value as { uploadId: string }).uploadId;
      continue;
    }
    if (Array.isArray(value) && value.every((item) => item && typeof item === "object" && "uploadId" in item)) {
      record[key] = value.map((item) => (item as { uploadId: string }).uploadId);
    }
  }
  return record;
}

function FileField({
  field,
  value,
  onChange,
  onUploadStateChange,
  disabled,
}: {
  field: (typeof spec.steps)[number]["fields"][number];
  value?: unknown;
  onChange: (value: unknown) => void;
  onUploadStateChange: (fieldId: string, state: { pending: boolean; error: boolean }) => void;
  disabled: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const maxFiles = field.maxFiles === 5 ? 5 : 1;
  const accept = Array.isArray(field.accept) && field.accept.length > 0 ? field.accept.join(",") : undefined;
  const files = Array.isArray(value) ? value : value ? [value] : [];

  async function handleChange(list: FileList | null) {
    if (disabled || pending || !list || list.length === 0) return;
    setError("");
    if (list.length > maxFiles) {
      const message = maxFiles === 1 ? "Choose one file." : "Choose up to " + maxFiles + " files.";
      setError(message);
      onUploadStateChange(field.id, { pending: false, error: true });
      return;
    }
    const selected = Array.from(list);
    onUploadStateChange(field.id, { pending: true, error: false });
    setPending(true);
    try {
      const uploaded = [];
      for (const file of selected) {
        const authorize = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fieldId: field.id,
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            size: file.size,
          }),
        });
        const body = await authorize.json().catch(() => null);
        if (!authorize.ok || !body || !body.uploadId) {
          throw new Error(body && body.error ? body.error : "Could not start upload.");
        }
        if (body.upload.method === "PUT") {
          const response = await fetch(body.upload.url, {
            method: "PUT",
            headers: { ...(body.upload.headers || {}), "Content-Type": file.type || "application/octet-stream" },
            body: file,
          });
          if (!response.ok) throw new Error("Upload failed. Try again.");
        } else {
          const formData = new FormData();
          for (const [key, next] of Object.entries(body.upload.fields || {})) formData.append(key, String(next));
          formData.append("file", file);
          const response = await fetch(body.upload.url, { method: "POST", body: formData });
          if (!response.ok) throw new Error("Upload failed. Try again.");
        }
        uploaded.push({ uploadId: body.uploadId, name: file.name, size: file.size, contentType: file.type || "application/octet-stream" });
      }
      onUploadStateChange(field.id, { pending: false, error: false });
      onChange(maxFiles === 1 ? uploaded[0] : uploaded);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
      onUploadStateChange(field.id, { pending: false, error: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Input id={"field-" + field.id} type="file" accept={accept} multiple={maxFiles > 1} disabled={disabled || pending} aria-invalid={Boolean(error)} aria-describedby={error ? field.id + "-upload-error" : pending ? field.id + "-upload-status" : undefined} onChange={(event) => { void handleChange(event.target.files); event.target.value = ""; }} />
      {pending ? <p id={field.id + "-upload-status"} role="status" className="text-sm text-muted-foreground">Uploading…</p> : null}
      {files.map((file: { name: string; size: number }, index: number) => (
        <div key={index} className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate">{file.name} · {formatBytes(file.size)}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || pending}
            onClick={() => {
              const next = files.filter((_: unknown, itemIndex: number) => itemIndex !== index);
              setError("");
              onUploadStateChange(field.id, { pending: false, error: false });
              onChange(next.length === 0 ? undefined : maxFiles === 1 ? next[0] : next);
            }}
          >
            Remove
          </Button>
        </div>
      ))}
      {error ? <Button type="button" variant="ghost" size="sm" disabled={disabled || pending} onClick={() => { onChange(undefined); setError(""); onUploadStateChange(field.id, { pending: false, error: false }); }}>Clear file selection</Button> : null}
      {error ? <p id={field.id + "-upload-error"} role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
`;
}
