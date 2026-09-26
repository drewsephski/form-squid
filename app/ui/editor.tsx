"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { generateAction } from "@/app/lib/actions/generate";
import { exportSubmissionsCsv, loadSubmissions } from "@/app/lib/actions/forms-read";
import { createSubmissionFileDownload } from "@/app/lib/actions/files";
import { publishForm, restoreVersion, updateDraft, updateNotifyEmail } from "@/app/lib/actions/forms-write";
import { trackFunnel } from "@/app/lib/analytics";
import { deleteSubmission } from "@/app/lib/actions/submissions-write";
import { compileAction } from "@/app/lib/actions/compile";
import { describeSpecChange } from "@/app/lib/diff-spec";
import { type FormSpec } from "@/app/lib/definitions";
import { specIssue, specsMatch } from "@/app/lib/edit-spec";
import { formatFileSize } from "@/app/lib/file-field";
import { deriveLaunchState, type LaunchTab } from "@/app/lib/launch-steps";
import { appOrigin, hostedHost, hostedUrl } from "@/app/lib/origin";
import { fileRefsFromValue, labeledAnswers, submissionIdentity, submissionSearchText } from "@/app/lib/submission-display";
import { formatPublished, formatResponseTime } from "@/lib/formatter";
import { CodeBlock } from "@/components/ui/code-block";
import { AnimateHeight } from "@/components/ui/animate-height";
import { AppearanceSettings } from "@/app/ui/appearance-settings";
import { FieldsInspector, FormSettings } from "@/app/ui/editor-inspector";
import { FormView } from "@/app/ui/form-view";
import { IntegrationsPanel, type WebhookPanelState } from "@/app/ui/integrations-panel";
import { LaunchChecklist } from "@/app/ui/launch-checklist";

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
  webhook: {
    id: string;
    url: string;
    enabled: boolean;
    hasSecret: true;
    secretMasked: string;
    createdAt: string;
    updatedAt: string;
    deliveries: Array<{
      id: string;
      submissionId: string | null;
      attempt: number;
      status: string;
      responseStatus: number | null;
      error: string | null;
      createdAt: string;
      deliveredAt: string | null;
    }>;
  } | null;
}

function liveHref(slug: string) {
  if (typeof window === "undefined") {
    return hostedUrl(slug);
  }
  return hostedUrl(slug, window.location);
}

function scrollIntoViewGentle(element: HTMLElement) {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
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
  const [savedNotifyEmail, setSavedNotifyEmail] = useState(form.notifyEmail);
  const [instruction, setInstruction] = useState("");
  const [candidate, setCandidate] = useState<FormSpec | null>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(form.submissions[0]?.id ?? "");
  const [extraSubmissions, setExtraSubmissions] = useState<EditorForm["submissions"]>([]);
  const [nextCursor, setNextCursor] = useState(form.nextCursor);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [deletingSubmission, setDeletingSubmission] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState("");
  const [compiling, setCompiling] = useState(false);
  const [compiled, setCompiled] = useState<{ schemaSource: string; formSource: string } | null>(null);
  const [previewVersionId, setPreviewVersionId] = useState("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [lowerTab, setLowerTab] = useState<LaunchTab>("submissions");
  const [webhook, setWebhook] = useState<WebhookPanelState | null>(form.webhook);
  const [highlightNotifyEmail, setHighlightNotifyEmail] = useState(false);
  const saveSeq = useRef(0);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const serverSubmissions = useRef(form.submissions);
  const lowerTabsRef = useRef<HTMLDivElement>(null);
  const notifyEmailRef = useRef<HTMLElement>(null);
  const focusNotifyAfterTab = useRef(false);

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
    setRemovedIds([]);
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

  const submissions = [...form.submissions, ...extraSubmissions].filter((row) => !removedIds.includes(row.id));
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

  const launchState = deriveLaunchState({
    published,
    notifyEmail: savedNotifyEmail,
    webhookEnabled: Boolean(webhook?.enabled),
    submissionCount: submissions.length > 0 || Boolean(nextCursor) ? Math.max(submissions.length, 1) : 0,
  });

  function handleLowerTabChange(value: string | number | null) {
    if (value === "submissions" || value === "integrations" || value === "code") {
      setLowerTab(value);
    }
  }

  function goToLowerTab(tab: LaunchTab, options?: { focusNotifyEmail?: boolean }) {
    focusNotifyAfterTab.current = Boolean(options?.focusNotifyEmail);
    setLowerTab(tab);
    window.requestAnimationFrame(() => {
      if (lowerTabsRef.current) {
        scrollIntoViewGentle(lowerTabsRef.current);
      }
      if (options?.focusNotifyEmail) {
        window.setTimeout(() => {
          notifyEmailRef.current?.focus();
          setHighlightNotifyEmail(true);
          window.setTimeout(() => setHighlightNotifyEmail(false), 2400);
          focusNotifyAfterTab.current = false;
        }, 50);
      }
    });
  }

  useEffect(() => {
    if (lowerTab !== "submissions" || !focusNotifyAfterTab.current) {
      return;
    }
    notifyEmailRef.current?.focus();
    setHighlightNotifyEmail(true);
    const clear = window.setTimeout(() => setHighlightNotifyEmail(false), 2400);
    focusNotifyAfterTab.current = false;
    return () => window.clearTimeout(clear);
  }, [lowerTab]);

  async function handlePublish() {
    const issue = specIssue(spec);
    if (issue) {
      toast.error(issue);
      return;
    }
    const firstPublish = !publishedSpec;
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
      toast.success(firstPublish ? "Form published" : "Changes published");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish.");
    } finally {
      setPending(false);
    }
  }

  async function handleEdit() {
    setPending(true);
    try {
      const result = await generateAction(instruction, spec);
      if (result.error || !result.spec) {
        toast.error(result.error ?? "Could not edit the form.");
        return;
      }
      setCandidate(result.spec);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not edit the form.");
    } finally {
      setPending(false);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(liveHref(publishedSlug));
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy the link.");
    }
  }

  function handleOpenLive() {
    window.open(liveHref(publishedSlug), "_blank", "noopener,noreferrer");
  }

  async function handleSaveNotifyEmail(event: FormEvent) {
    event.preventDefault();
    setSavingEmail(true);
    try {
      await updateNotifyEmail(form.id, notifyEmail);
      setSavedNotifyEmail(notifyEmail);
      toast.success(
        notifyEmail.trim()
          ? "Notification email saved. First messages often land in spam — mark FormSquid as not spam."
          : "Notification email cleared.",
      );
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not save email");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleLoadMore() {
    if (!nextCursor || loadingMore) {
      return;
    }
    setLoadingMore(true);
    try {
      const page = await loadSubmissions(form.id, nextCursor);
      setExtraSubmissions((current) => [...current, ...page.submissions]);
      setNextCursor(page.nextCursor);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not load more responses.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleExportCsv() {
    if (exportingCsv) {
      return;
    }
    setExportingCsv(true);
    try {
      const csv = await exportSubmissionsCsv(form.id);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${sourceSlug}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("CSV downloaded");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not export submissions.");
    } finally {
      setExportingCsv(false);
    }
  }

  async function handleDeleteSubmission() {
    if (!selected || deletingSubmission) {
      return;
    }
    const deletedId = selected.id;
    const remaining = visibleSubmissions.filter((row) => row.id !== deletedId);
    setDeletingSubmission(true);
    try {
      await deleteSubmission(form.id, deletedId);
      setRemovedIds((current) => [...current, deletedId]);
      setSelectedId(remaining[0]?.id ?? "");
      setDeleteOpen(false);
      toast.success("Response deleted");
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not delete the response.");
      setDeleteOpen(false);
    } finally {
      setDeletingSubmission(false);
    }
  }

  async function handleDownloadFile(fileId: string) {
    if (downloadingFileId) {
      return;
    }
    setDownloadingFileId(fileId);
    try {
      const result = await createSubmissionFileDownload(form.id, fileId);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not download file.");
    } finally {
      setDownloadingFileId("");
    }
  }

  async function handleRestore(versionId: string, versionNumber: number) {
    setPending(true);
    try {
      const next = await restoreVersion(form.id, versionId);
      setSpec(next);
      setPreviewVersionId("");
      toast.success(`Restored version ${versionNumber}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not restore version.");
    } finally {
      setPending(false);
    }
  }

  async function handleCompile(mode: "component" | "schema" | "download") {
    if (compiling) {
      return;
    }
    setCompiling(true);
    try {
      const result = await compileAction(spec, sourceSlug);
      setCompiled(result);
      if (mode === "component") {
        await navigator.clipboard.writeText(result.formSource);
        toast.success("Component copied");
      } else if (mode === "schema") {
        await navigator.clipboard.writeText(result.schemaSource);
        toast.success("Schema copied");
      } else {
        const blob = new Blob(
          [`// schema.ts\n${result.schemaSource}\n\n// form.tsx\n${result.formSource}`],
          { type: "text/plain" },
        );
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${sourceSlug}.txt`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success("Source downloaded");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not generate source.");
    } finally {
      setCompiling(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-8">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href="/forms"
          className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          ← My forms
        </Link>
        <div className="min-w-0 flex-1 basis-full sm:basis-auto">
          <h1 className="truncate font-heading text-xl font-medium tracking-tight sm:text-2xl">
            {spec.title || "Untitled form"}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          <span
            className={`mr-2 inline-block size-1.5 rounded-full align-middle ${published ? "bg-foreground" : "bg-muted-foreground/60"}`}
            aria-hidden="true"
          />
          {published ? "Published" : "Draft"}
        </p>
      </header>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-3">
          <div className="flex gap-2" role="group" aria-label="Preview size">
            <Button type="button" variant={previewDevice === "desktop" ? "default" : "outline"} onClick={() => setPreviewDevice("desktop")}>
              Desktop
            </Button>
            <Button type="button" variant={previewDevice === "mobile" ? "default" : "outline"} onClick={() => setPreviewDevice("mobile")}>
              Mobile
            </Button>
          </div>
          <div className={previewDevice === "mobile" ? "mx-auto w-[390px] max-w-full" : "min-w-0"}>
            <AnimateHeight>
              <div className="min-w-0 overflow-x-auto rounded-xl border bg-muted/30 p-6">
                <FormView spec={spec} preview />
              </div>
            </AnimateHeight>
          </div>
        </div>
        <Tabs defaultValue="ai" className="min-w-0">
          <TabsList className="flex h-auto flex-wrap">
            <TabsTrigger value="ai">AI</TabsTrigger>
            <TabsTrigger value="fields">Fields</TabsTrigger>
            <TabsTrigger value="form">Form</TabsTrigger>
            <TabsTrigger value="appearance">Appearance</TabsTrigger>
          </TabsList>
          <TabsContent value="ai" className="min-w-0 space-y-3">
            <Textarea aria-label="Edit instruction" value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Split this into two steps." />
            <Button type="button" onClick={() => void handleEdit()} disabled={pending}>Ask FormSquid</Button>
            <AnimateHeight>
              {candidate ? (
                <div className="space-y-2 rounded-lg border p-3 text-sm">
                  {describeSpecChange(spec, candidate).map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                  <Button type="button" onClick={() => { setSpec(candidate); setCandidate(null); }}>Apply</Button>
                </div>
              ) : null}
            </AnimateHeight>
          </TabsContent>
          <TabsContent value="fields" className="min-w-0">
            <AnimateHeight>
              <FieldsInspector spec={spec} slug={slug} selectedId={selectedFieldId} onSpec={setSpec} onSlug={setSlug} onSelect={setSelectedFieldId} />
            </AnimateHeight>
          </TabsContent>
          <TabsContent value="form" className="min-w-0">
            <AnimateHeight>
              <FormSettings spec={spec} slug={slug} selectedId={selectedFieldId} onSpec={setSpec} onSlug={setSlug} onSelect={setSelectedFieldId} />
            </AnimateHeight>
          </TabsContent>
          <TabsContent value="appearance" className="min-w-0">
            <AnimateHeight>
              <AppearanceSettings spec={spec} onSpec={setSpec} />
            </AnimateHeight>
          </TabsContent>
        </Tabs>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm" aria-live="polite">
            {published ? <span className="mr-2 inline-block size-1.5 rounded-full bg-foreground align-middle" aria-hidden="true" /> : null}
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
          <p className="text-sm text-muted-foreground" aria-live="polite">{status}</p>
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

      {published ? (
        <LaunchChecklist
          state={launchState}
          onCopyLink={() => void handleCopyLink()}
          onOpenLive={handleOpenLive}
          onGoToTab={goToLowerTab}
        />
      ) : null}

      <div ref={lowerTabsRef}>
        <Tabs value={lowerTab} onValueChange={handleLowerTabChange} className="min-w-0">
          <TabsList>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
            <TabsTrigger value="integrations">Integrations</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
          </TabsList>
          {/* Stack panels in one grid cell so height stays equal across tabs (no layout shift). */}
          <div className="grid min-w-0 [&>[data-slot=tabs-content]]:col-start-1 [&>[data-slot=tabs-content]]:row-start-1">
          <TabsContent
            value="submissions"
            keepMounted
            className="min-w-0 space-y-4 [&[hidden]]:block [&[hidden]]:invisible [&[hidden]]:pointer-events-none"
          >
            <form className="flex gap-2" onSubmit={(event) => void handleSaveNotifyEmail(event)}>
              <Input
                ref={notifyEmailRef}
                aria-label="Notification email"
                type="email"
                value={notifyEmail}
                onChange={(event) => setNotifyEmail(event.target.value)}
                placeholder="Notifications are off until you add an email"
                className={highlightNotifyEmail ? "ring-3 ring-ring/50" : undefined}
              />
              <Button type="submit" variant="outline" disabled={savingEmail}>
                {savingEmail ? "Saving…" : "Save email"}
              </Button>
            </form>
            <p className="text-sm text-muted-foreground">
              New submissions are emailed here. The inbox keeps a copy either way. First emails often land in spam — open one and choose &quot;Report not spam&quot; so later ones reach your inbox.
            </p>
            <Input aria-label="Search submissions" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={nextCursor ? "Search loaded responses" : "Search responses"} />
            <div className="grid gap-4 lg:grid-cols-[minmax(14rem,20rem)_minmax(0,1fr)]">
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
                    const isSelected = selected?.id === row.id;
                    return (
                      <li key={row.id}>
                        <button
                          type="button"
                          aria-current={isSelected ? "true" : undefined}
                          className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${isSelected ? "bg-muted" : ""}`}
                          onClick={() => setSelectedId(row.id)}
                        >
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
                    disabled={loadingMore}
                    onClick={() => void handleLoadMore()}
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </Button>
                ) : null}
              </div>
              {selected ? (
                <div className="min-w-0 space-y-4">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{submissionIdentity(selectedSpec, selected.payload).title}</p>
                      <p className="text-sm text-muted-foreground">{formatResponseTime(selected.createdAt)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={exportingCsv}
                        onClick={() => void handleExportCsv()}
                      >
                        {exportingCsv ? "Downloading…" : "Download CSV"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteOpen(true)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  <dl className="divide-y rounded-lg border">
                    {labeledAnswers(selectedSpec, selected.payload).map((answer) => {
                      const field = selectedSpec?.steps.flatMap((step) => step.fields).find((item) => item.id === answer.id);
                      const files = field?.type === "file" ? fileRefsFromValue((selected.payload as Record<string, unknown>)?.[answer.id]) : [];
                      const longAnswer = answer.value.length > 64 || answer.value.includes("\n") || files.length > 0;
                      return (
                        <div
                          key={answer.id}
                          className={
                            longAnswer
                              ? "space-y-1 px-3 py-2.5"
                              : "grid gap-1 px-3 py-2.5 sm:grid-cols-[minmax(7rem,11rem)_minmax(0,1fr)] sm:items-baseline sm:gap-4"
                          }
                        >
                          <dt className="text-sm text-muted-foreground">{answer.label}</dt>
                          <dd className="min-w-0 break-words text-sm leading-snug whitespace-pre-wrap">
                            {files.length > 0 ? (
                              <ul className="space-y-2">
                                {files.map((file) => (
                                  <li key={file.id} className="flex flex-wrap items-center gap-2">
                                    <span>
                                      {file.name} · {formatFileSize(file.size)}
                                    </span>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={downloadingFileId === file.id}
                                      onClick={() => void handleDownloadFile(file.id)}
                                    >
                                      {downloadingFileId === file.id ? "Opening…" : "Download"}
                                    </Button>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              answer.value
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
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
                            <Button
                              type="button"
                              variant="outline"
                              disabled={pending}
                              onClick={() => void handleRestore(version.id, version.versionNumber)}
                            >
                              Restore
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <AnimateHeight>
                  {previewVersion?.spec ? (
                    <div className="rounded-xl border p-6">
                      <p className="mb-4 text-sm text-muted-foreground">Preview of v{previewVersion.versionNumber}</p>
                      <FormView spec={previewVersion.spec} preview />
                    </div>
                  ) : null}
                </AnimateHeight>
              </div>
            ) : null}
          </TabsContent>
          <TabsContent
            value="integrations"
            keepMounted
            className="min-w-0 [&[hidden]]:block [&[hidden]]:invisible [&[hidden]]:pointer-events-none"
          >
            <IntegrationsPanel formId={form.id} initialWebhook={form.webhook} onWebhookChange={setWebhook} />
          </TabsContent>
          <TabsContent
            value="code"
            keepMounted
            className="min-w-0 space-y-4 [&[hidden]]:block [&[hidden]]:invisible [&[hidden]]:pointer-events-none"
          >
            <div className="min-w-0 space-y-2">
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
            <div className="min-w-0 space-y-2">
              <h2 className="text-sm font-medium">Current draft source</h2>
              {!published || unpublished ? (
                <p className="text-sm text-muted-foreground">
                  Draft source uses the draft address. Publish these changes before FormSquid-hosted submissions will accept this version.
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" disabled={compiling} onClick={() => void handleCompile("component")}>
                  Copy component
                </Button>
                <Button type="button" variant="outline" disabled={compiling} onClick={() => void handleCompile("schema")}>
                  Copy schema
                </Button>
                <Button type="button" variant="outline" disabled={compiling} onClick={() => void handleCompile("download")}>
                  Download
                </Button>
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
          </div>
        </Tabs>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (!deletingSubmission) setDeleteOpen(open); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this response?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the response and any uploaded files attached to it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingSubmission}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingSubmission}
              onClick={() => void handleDeleteSubmission()}
            >
              {deletingSubmission ? "Deleting…" : "Delete response"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
