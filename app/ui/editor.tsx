"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { generateAction } from "@/app/lib/actions/generate";
import { exportSubmissionsCsv, loadSubmissions } from "@/app/lib/actions/forms-read";
import { publishForm, restoreVersion, updateDraft, updateNotifyEmail } from "@/app/lib/actions/forms-write";
import { trackFunnel } from "@/app/lib/analytics";
import { deleteSubmission } from "@/app/lib/actions/submissions-write";
import { compileAction } from "@/app/lib/actions/compile";
import { describeSpecChange } from "@/app/lib/diff-spec";
import { type FormSpec } from "@/app/lib/definitions";
import { specIssue, specsMatch } from "@/app/lib/edit-spec";
import { appOrigin, hostedHost, hostedUrl } from "@/app/lib/origin";
import { labeledAnswers, submissionIdentity, submissionSearchText } from "@/app/lib/submission-display";
import { formatPublished, formatResponseTime } from "@/lib/formatter";
import { CodeBlock } from "@/components/ui/code-block";
import { AppearanceSettings } from "@/app/ui/appearance-settings";
import { FieldsInspector, FormSettings } from "@/app/ui/editor-inspector";
import { FormView } from "@/app/ui/form-view";

interface EditorForm {
  id: string;
  slug: string;
  draftSlug: string;
  notifyEmail: string;
  registryKey: string;
  draftSpec: FormSpec;
  publishedVersionId: string | null;
  publishedSpec: FormSpec | null;
  publishedAt: string | null;
  versions: Array<{ id: string; versionNumber: number; createdAt: string; spec: FormSpec | null }>;
  submissions: Array<{ id: string; formVersionId: string; payload: unknown; createdAt: string }>;
  nextCursor: string | null;
}

function liveHref(slug: string) {
  if (typeof window === "undefined") {
    return hostedUrl(slug);
  }
  return hostedUrl(slug, window.location);
}

export function Editor({ form }: { form: EditorForm }) {
  const router = useRouter();
  const [spec, setSpec] = useState(form.draftSpec);
  const [slug, setSlug] = useState(form.draftSlug);
  const [savedSpec, setSavedSpec] = useState(form.draftSpec);
  const [savedSlug, setSavedSlug] = useState(form.draftSlug);
  const [publishedSlug, setPublishedSlug] = useState(form.slug);
  const [publishedSpec, setPublishedSpec] = useState(form.publishedSpec);
  const [publishedAt, setPublishedAt] = useState(form.publishedAt);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [selectedFieldId, setSelectedFieldId] = useState("");
  const [notifyEmail, setNotifyEmail] = useState(form.notifyEmail);
  const [instruction, setInstruction] = useState("");
  const [candidate, setCandidate] = useState<FormSpec | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(form.submissions[0]?.id ?? "");
  const [extraSubmissions, setExtraSubmissions] = useState<EditorForm["submissions"]>([]);
  const [nextCursor, setNextCursor] = useState(form.nextCursor);
  const [pending, setPending] = useState(false);
  const [compiled, setCompiled] = useState<{ schemaSource: string; formSource: string } | null>(null);
  const [previewVersionId, setPreviewVersionId] = useState("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const saveSeq = useRef(0);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const serverSubmissions = useRef(form.submissions);

  const draftIssue = specIssue(spec);
  const dirty = !specsMatch(spec, savedSpec) || slug !== savedSlug;
  const showSaving = dirty && saving;
  const showSaveError = dirty ? saveError : "";

  useEffect(() => {
    if (serverSubmissions.current === form.submissions) {
      return;
    }
    serverSubmissions.current = form.submissions;
    setExtraSubmissions([]);
    setNextCursor(form.nextCursor);
  }, [form.submissions, form.nextCursor]);

  useEffect(() => {
    if (!dirty || draftIssue) {
      return;
    }
    const seq = saveSeq.current + 1;
    saveSeq.current = seq;
    const timer = window.setTimeout(() => {
      const job = writeQueue.current.catch(() => undefined).then(async () => {
        if (saveSeq.current !== seq) {
          return;
        }
        setSaving(true);
        try {
          await updateDraft(form.id, spec, slug);
          if (saveSeq.current !== seq) {
            return;
          }
          setSavedSpec(spec);
          setSavedSlug(slug);
          setSaving(false);
          setSaveError("");
        } catch (error: unknown) {
          if (saveSeq.current !== seq) {
            return;
          }
          setSaving(false);
          setSaveError(error instanceof Error ? error.message : "Could not save.");
        }
      });
      writeQueue.current = job;
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [dirty, draftIssue, form.id, slug, spec]);

  const submissions = [...form.submissions, ...extraSubmissions];
  const visibleSubmissions = submissions.filter((row) => {
    const version = form.versions.find((item) => item.id === row.formVersionId)?.spec ?? null;
    return submissionSearchText(version, row.payload).includes(query.trim().toLowerCase());
  });
  const selected = visibleSubmissions.find((row) => row.id === selectedId) ?? visibleSubmissions[0];
  const selectedSpec = selected ? form.versions.find((version) => version.id === selected.formVersionId)?.spec ?? null : null;
  const published = Boolean(publishedSpec);
  const unpublished = publishedSpec !== null && (!specsMatch(spec, publishedSpec) || slug !== publishedSlug);
  const sourceSlug = slug;
  const previewVersion = form.versions.find((version) => version.id === previewVersionId) ?? null;
  const status = showSaving
    ? "Saving…"
    : dirty
      ? draftIssue || showSaveError || "Unsaved changes"
      : unpublished
        ? "Unpublished changes"
        : published && publishedAt
          ? formatPublished(publishedAt)
          : "Saved";

  async function handlePublish() {
    const issue = specIssue(spec);
    if (issue) {
      toast.error(issue);
      return;
    }
    setPending(true);
    saveSeq.current += 1;
    try {
      await writeQueue.current.catch(() => undefined);
      const nextSpec = spec;
      const nextSlug = slug;
      await publishForm(form.id, nextSpec, nextSlug);
      trackFunnel("form_published", { page: "/forms", authenticated: true });
      saveSeq.current += 1;
      setSavedSpec(nextSpec);
      setSavedSlug(nextSlug);
      setPublishedSlug(nextSlug);
      setPublishedSpec(nextSpec);
      setPublishedAt(new Date().toISOString());
      setSaving(false);
      setSaveError("");
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

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(liveHref(publishedSlug));
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link.");
    }
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-3">
          <div className="flex gap-2" role="group" aria-label="Preview size">
            <Button type="button" variant={previewDevice === "desktop" ? "default" : "outline"} onClick={() => setPreviewDevice("desktop")}>
              Desktop
            </Button>
            <Button type="button" variant={previewDevice === "mobile" ? "default" : "outline"} onClick={() => setPreviewDevice("mobile")}>
              Mobile
            </Button>
          </div>
          <div className={previewDevice === "mobile" ? "mx-auto w-[390px] max-w-full" : undefined}>
            <div className="rounded-xl border bg-muted/30 p-6">
              <FormView spec={spec} preview />
            </div>
          </div>
        </div>
        <Tabs defaultValue="ai">
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="ai">AI</TabsTrigger>
            <TabsTrigger value="fields">Fields</TabsTrigger>
            <TabsTrigger value="form">Form</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
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
          <TabsContent value="fields">
            <FieldsInspector spec={spec} slug={slug} selectedId={selectedFieldId} onSpec={setSpec} onSlug={setSlug} onSelect={setSelectedFieldId} />
          </TabsContent>
          <TabsContent value="form">
            <FormSettings spec={spec} slug={slug} selectedId={selectedFieldId} onSpec={setSpec} onSlug={setSlug} onSelect={setSelectedFieldId} />
          </TabsContent>
          <TabsContent value="appearance">
            <AppearanceSettings spec={spec} onSpec={setSpec} />
          </TabsContent>
        </Tabs>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm">
            {published ? <span className="mr-2 inline-block size-2 rounded-full bg-primary align-middle" aria-hidden="true" /> : null}
            {published ? "Published" : "Draft"}
          </p>
          {published ? (
            <p className="font-mono text-sm">
              <span className="text-muted-foreground">Published: </span>
              {hostedHost(publishedSlug)}
            </p>
          ) : null}
          {published && slug !== publishedSlug ? (
            <p className="font-mono text-sm">
              <span className="text-muted-foreground">Draft address: </span>
              {hostedHost(slug)}
            </p>
          ) : null}
          {!published ? <p className="font-mono text-sm">{hostedHost(slug)}</p> : null}
          <p className="text-sm text-muted-foreground">{status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {published ? (
            <Button type="button" variant="outline" onClick={() => void handleCopyLink()}>
              Copy link
            </Button>
          ) : null}
          {published ? (
            <a href={liveHref(publishedSlug)} target="_blank" rel="noreferrer">
              <Button type="button" variant="outline">Open live</Button>
            </a>
          ) : null}
          <Button type="button" onClick={() => void handlePublish()} disabled={pending || Boolean(draftIssue)}>
            {unpublished ? "Publish changes" : "Publish"}
          </Button>
        </div>
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
          <p className="text-sm text-muted-foreground">New submissions are emailed here. The inbox keeps a copy either way.</p>
          <Input aria-label="Search submissions" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={nextCursor ? "Search loaded responses" : "Search responses"} />
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              {visibleSubmissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {submissions.length === 0
                    ? "No submissions yet."
                    : query.trim() && nextCursor
                      ? "No matches in loaded responses. Load more to search older responses."
                      : "No matching responses."}
                </p>
              ) : (
              <ul className="divide-y rounded-lg border">
                {visibleSubmissions.map((row) => {
                  const version = form.versions.find((item) => item.id === row.formVersionId)?.spec ?? null;
                  const identity = submissionIdentity(version, row.payload);
                  return (
                    <li key={row.id}>
                      <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => setSelectedId(row.id)}>
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{identity.title}</span>
                          {identity.detail ? <span className="block truncate text-muted-foreground">{identity.detail}</span> : null}
                        </span>
                        <span className="shrink-0 text-muted-foreground">{formatResponseTime(row.createdAt)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              )}
              {nextCursor ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    void loadSubmissions(form.id, nextCursor).then((page) => {
                      setExtraSubmissions((current) => [...current, ...page.submissions]);
                      setNextCursor(page.nextCursor);
                    });
                  }}
                >
                  Load more
                </Button>
              ) : null}
            </div>
            {selected ? (
              <div className="space-y-4">
                <div>
                  <p className="font-medium">{submissionIdentity(selectedSpec, selected.payload).title}</p>
                  <p className="text-sm text-muted-foreground">{formatResponseTime(selected.createdAt)}</p>
                </div>
                <dl className="space-y-3">
                  {labeledAnswers(selectedSpec, selected.payload).map((answer) => (
                    <div key={answer.id}>
                      <dt className="text-sm text-muted-foreground">{answer.label}</dt>
                      <dd>{answer.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void exportSubmissionsCsv(form.id).then((csv) => {
                        const blob = new Blob([csv], { type: "text/csv" });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `${sourceSlug}.csv`;
                        link.click();
                        URL.revokeObjectURL(url);
                      }).catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Could not export submissions."));
                    }}
                  >
                    Download CSV
                  </Button>
                  <Button type="button" variant="outline" onClick={() => void deleteSubmission(form.id, selected.id).then(() => router.refresh())}>Delete</Button>
                </div>
              </div>
            ) : null}
          </div>
          {form.versions.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-medium">Version history</h2>
              <ul className="divide-y rounded-lg border">
                {form.versions.map((version) => {
                  const current = version.id === form.publishedVersionId;
                  return (
                    <li key={version.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                      <div>
                        <p className="text-sm">v{version.versionNumber} · {formatResponseTime(version.createdAt)}</p>
                        {current ? <p className="text-xs text-muted-foreground">Current published</p> : null}
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" disabled={!version.spec} onClick={() => setPreviewVersionId(version.id)}>
                          Preview
                        </Button>
                        {current ? null : (
                          <Button type="button" variant="outline" onClick={() => void restoreVersion(form.id, version.id).then((next) => { setSpec(next); setPreviewVersionId(""); toast.success(`Restored version ${version.versionNumber}`); })}>
                            Restore
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {previewVersion?.spec ? (
                <div className="rounded-xl border p-6">
                  <p className="mb-4 text-sm text-muted-foreground">Preview of v{previewVersion.versionNumber}</p>
                  <FormView spec={previewVersion.spec} preview />
                </div>
              ) : null}
            </div>
          ) : null}
        </TabsContent>
        <TabsContent value="code" className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-sm font-medium">Install published form</h2>
            {published ? (
              <>
                <CodeBlock
                  code={`npx shadcn@latest add ${appOrigin()}/r/${form.registryKey}.json`}
                  copyable
                  label="Install command"
                  language="bash"
                  showLineNumbers={false}
                />
                {unpublished ? <p className="text-sm text-muted-foreground">The registry contains your last published version. Publish changes to update it.</p> : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Publish this form to get a shadcn registry install command.</p>
            )}
          </div>
          <div className="space-y-2">
            <h2 className="text-sm font-medium">Current draft source</h2>
            {!published || unpublished ? (
              <p className="text-sm text-muted-foreground">
                Draft source uses the draft address. Publish these changes before FormSquid-hosted submissions will accept this version.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void compileAction(spec, sourceSlug).then((result) => { setCompiled(result); void navigator.clipboard.writeText(result.formSource); })}>Copy component</Button>
              <Button type="button" variant="outline" onClick={() => void compileAction(spec, sourceSlug).then((result) => { setCompiled(result); void navigator.clipboard.writeText(result.schemaSource); })}>Copy schema</Button>
              <Button type="button" variant="outline" onClick={() => void compileAction(spec, sourceSlug).then((result) => {
                setCompiled(result);
                const blob = new Blob([`// schema.ts\n${result.schemaSource}\n\n// form.tsx\n${result.formSource}`], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `${sourceSlug}.txt`;
                link.click();
                URL.revokeObjectURL(url);
              })}>Download</Button>
            </div>
          </div>
          {compiled?.formSource ? (
            <CodeBlock
              code={compiled.formSource}
              filename="form.tsx"
              label="Component source"
              language="tsx"
              maxHeight="24rem"
            />
          ) : (
            <p className="text-sm text-muted-foreground">Copy or download to generate the source.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
