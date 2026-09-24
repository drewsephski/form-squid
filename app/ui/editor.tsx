"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { generateAction } from "@/app/lib/actions/generate";
import { publishForm, restoreVersion, updateDraft, updateNotifyEmail } from "@/app/lib/actions/forms-write";
import { deleteSubmission } from "@/app/lib/actions/submissions-write";
import { compileAction } from "@/app/lib/actions/compile";
import { describeSpecChange } from "@/app/lib/diff-spec";
import { formSpecSchema, type FormField, type FormSpec } from "@/app/lib/definitions";
import { FormView } from "@/app/ui/form-view";

interface EditorForm {
  id: string;
  slug: string;
  notifyEmail: string;
  registryKey: string;
  draftSpec: FormSpec;
  publishedVersionId: string | null;
  versions: Array<{ id: string; versionNumber: number; createdAt: string }>;
  submissions: Array<{ id: string; formVersionId: string; payload: unknown; createdAt: string }>;
}

export function Editor({ form }: { form: EditorForm }) {
  const router = useRouter();
  const [spec, setSpec] = useState(form.draftSpec);
  const [slug, setSlug] = useState(form.slug);
  const [notifyEmail, setNotifyEmail] = useState(form.notifyEmail);
  const [instruction, setInstruction] = useState("");
  const [candidate, setCandidate] = useState<FormSpec | null>(null);
  const [selectedId, setSelectedId] = useState(form.submissions[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [compiled, setCompiled] = useState<{ schemaSource: string; formSource: string } | null>(null);
  const selected = form.submissions.find((row) => row.id === selectedId) ?? form.submissions[0];

  function updateField(fieldId: string, patch: Partial<FormField>) {
    setSpec((current) => ({
      ...current,
      steps: current.steps.map((step) => ({
        ...step,
        fields: step.fields.map((field) => (field.id === fieldId ? { ...field, ...patch } : field)),
      })),
    }));
  }

  function moveField(fieldId: string, direction: -1 | 1) {
    setSpec((current) => ({
      ...current,
      steps: current.steps.map((step) => {
        const index = step.fields.findIndex((field) => field.id === fieldId);
        const nextIndex = index + direction;
        if (index < 0 || nextIndex < 0 || nextIndex >= step.fields.length) {
          return step;
        }
        const fields = [...step.fields];
        const [item] = fields.splice(index, 1);
        if (!item) {
          return step;
        }
        fields.splice(nextIndex, 0, item);
        return { ...step, fields };
      }),
    }));
  }

  function deleteField(fieldId: string) {
    setSpec((current) => ({
      ...current,
      steps: current.steps.map((step) => ({
        ...step,
        fields: step.fields.filter((field) => field.id !== fieldId),
      })),
    }));
  }

  async function handleSave() {
    const parsed = formSpecSchema.safeParse(spec);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Fix the form before saving.");
      return;
    }
    setPending(true);
    try {
      await updateDraft(form.id, parsed.data, slug);
      toast.success("Draft saved");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  async function handlePublish() {
    setPending(true);
    try {
      await publishForm(form.id, spec, slug);
      toast.success("Published");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish.");
    } finally {
      setPending(false);
    }
  }

  async function handleEdit() {
    setPending(true);
    const result = await generateAction(instruction, spec);
    setPending(false);
    if (result.error || !result.spec) {
      toast.error(result.error ?? "Could not edit the form.");
      return;
    }
    setCandidate(result.spec);
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-xl border p-6">
          <FormView spec={spec} preview />
        </div>
        <Tabs defaultValue="ai">
          <TabsList>
            <TabsTrigger value="ai">AI</TabsTrigger>
            <TabsTrigger value="fields">Fields</TabsTrigger>
          </TabsList>
          <TabsContent value="ai" className="space-y-3">
            <Textarea aria-label="Edit instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Split this into two steps." />
            <Button type="button" onClick={() => void handleEdit()} disabled={pending}>Ask FormSquid</Button>
            {candidate ? (
              <div className="space-y-2 rounded-lg border p-3 text-sm">
                {describeSpecChange(spec, candidate).map((line) => (
                  <p key={line}>{line}</p>
                ))}
                <Button type="button" onClick={() => { setSpec(candidate); setCandidate(null); }}>Apply</Button>
              </div>
            ) : null}
          </TabsContent>
          <TabsContent value="fields" className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="slug">Address</Label>
              <Input id="slug" value={slug} onChange={(event) => setSlug(event.target.value)} />
            </div>
            {spec.steps.flatMap((step) => step.fields).map((field) => (
              <div key={field.id} className="grid gap-2 rounded-lg border p-3">
                <Label htmlFor={`${field.id}-label`}>{field.id}</Label>
                <Input id={`${field.id}-label`} value={field.label} onChange={(event) => updateField(field.id, { label: event.target.value })} />
                <Input aria-label={`${field.label} placeholder`} value={field.placeholder ?? ""} onChange={(event) => updateField(field.id, { placeholder: event.target.value || undefined })} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={field.required} onChange={(event) => updateField(field.id, { required: event.target.checked })} />
                  Required
                </label>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => moveField(field.id, -1)}>Up</Button>
                  <Button type="button" variant="outline" onClick={() => moveField(field.id, 1)}>Down</Button>
                  <Button type="button" variant="outline" onClick={() => deleteField(field.id)}>Delete</Button>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={() => void handleSave()} disabled={pending}>Save draft</Button>
        <Button type="button" onClick={() => void handlePublish()} disabled={pending}>Publish</Button>
      </div>
      <Tabs defaultValue="submissions">
        <TabsList>
          <TabsTrigger value="submissions">Submissions</TabsTrigger>
          <TabsTrigger value="code">Code</TabsTrigger>
        </TabsList>
        <TabsContent value="submissions" className="space-y-4">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void updateNotifyEmail(form.id, notifyEmail).then(() => toast.success("Notification email saved")).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not save email"));
            }}
          >
            <Input aria-label="Notification email" type="email" value={notifyEmail} onChange={(event) => setNotifyEmail(event.target.value)} placeholder="Notifications are off until you add an email" />
            <Button type="submit" variant="outline">Save email</Button>
          </form>
          <p className="text-sm text-muted-foreground">Email notifications send when RESEND_API_KEY is set. The inbox works either way.</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2">Submitted</th>
                    <th>Version</th>
                  </tr>
                </thead>
                <tbody>
                  {form.submissions.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="py-2">
                        <button type="button" className="underline" onClick={() => setSelectedId(row.id)}>{new Date(row.createdAt).toLocaleString()}</button>
                      </td>
                      <td>{form.versions.find((version) => version.id === row.formVersionId)?.versionNumber ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selected ? (
              <div className="space-y-3">
                <pre className="overflow-auto rounded-lg border p-3 text-xs">{JSON.stringify(selected.payload, null, 2)}</pre>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const header = Object.keys(selected.payload as Record<string, unknown>);
                    const body = form.submissions.map((row) => header.map((key) => JSON.stringify((row.payload as Record<string, unknown>)[key] ?? "")).join(",")).join("\n");
                    const blob = new Blob([[header.join(","), body].join("\n")], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `${slug}.csv`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download CSV
                </Button>
                <Button type="button" variant="outline" onClick={() => void deleteSubmission(form.id, selected.id).then(() => router.refresh())}>Delete</Button>
              </div>
            ) : <p className="text-muted-foreground">No submissions yet.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {form.versions.map((version) => (
              <Button key={version.id} type="button" variant="outline" onClick={() => void restoreVersion(form.id, version.id).then((next) => { setSpec(next); toast.success(`Restored version ${version.versionNumber}`); })}>
                Restore v{version.versionNumber}
              </Button>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="code" className="space-y-3">
          <p className="font-mono text-sm">npx shadcn@latest add {typeof window === "undefined" ? "" : window.location.origin}/r/{form.registryKey}.json</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => void compileAction(spec, slug).then((result) => { setCompiled(result); void navigator.clipboard.writeText(result.formSource); })}>Copy component</Button>
            <Button type="button" variant="outline" onClick={() => void compileAction(spec, slug).then((result) => { setCompiled(result); void navigator.clipboard.writeText(result.schemaSource); })}>Copy schema</Button>
            <Button type="button" variant="outline" onClick={() => void compileAction(spec, slug).then((result) => {
              setCompiled(result);
              const blob = new Blob([`// schema.ts\n${result.schemaSource}\n\n// form.tsx\n${result.formSource}`], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `${slug}.txt`;
              link.click();
              URL.revokeObjectURL(url);
            })}>Download</Button>
          </div>
          <pre className="max-h-96 overflow-auto rounded-lg border p-3 text-xs">{compiled?.formSource ?? "Copy or download to generate the source."}</pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}
