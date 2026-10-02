"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AITextLoading } from "@/components/ui/ai-text-loading";
import { AnimateHeight } from "@/components/ui/animate-height";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateAction } from "@/app/lib/actions/generate";
import { saveForm } from "@/app/lib/actions/forms-write";
import { currentReferrer, trackFunnel } from "@/app/lib/analytics";
import { type FormSpec } from "@/app/lib/definitions";
import { clearBrowserDraft, parseBrowserDraft, readBrowserDraftSnapshot, storeDraftPrompt, storePendingSpec, subscribeBrowserDraft } from "@/app/lib/browser-draft";
import { promptPresets } from "@/app/lib/prompt-presets";
import { FormView } from "@/app/ui/form-view";
import { authClient } from "@/lib/auth-client";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function serverDraftSnapshot() {
  return null;
}

function GeneratingMark() {
  return (
    <div className="flex min-h-72 w-full flex-col items-center justify-center gap-6 py-6 sm:min-h-80 sm:gap-10" aria-hidden="true">
      <div className="loader generate-loader">
        <div className="box">
          <div className="logo">
            <Image src="/squid.png" alt="" width={94} height={94} />
          </div>
        </div>
        <div className="box" />
        <div className="box" />
        <div className="box" />
        <div className="box" />
      </div>
      <AITextLoading
        texts={["Thinking...", "Drafting fields...", "Shaping layout...", "Almost ready..."]}
        interval={1600}
      />
    </div>
  );
}

export function Generator() {
  const router = useRouter();
  const snapshot = useSyncExternalStore(subscribeBrowserDraft, readBrowserDraftSnapshot, serverDraftSnapshot);
  const storedDraft = useMemo(() => parseBrowserDraft(snapshot), [snapshot]);
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null);
  const prompt = editedPrompt ?? storedDraft.prompt;
  const [spec, setSpec] = useState<FormSpec | null>(null);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAllPresets, setShowAllPresets] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  function updatePrompt(value: string) {
    setEditedPrompt(value);
    setStorageError(storeDraftPrompt(value) ? "" : "Browser storage is unavailable. Keep this page open to preserve your work.");
  }

  function resumeDraft() {
    setSpec(storedDraft.spec);
    stageRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
  }

  function startOver() {
    if (!clearBrowserDraft()) {
      setStorageError("Could not clear the saved draft. Check your browser storage settings and try again.");
      return;
    }
    setEditedPrompt("");
    setSpec(null);
    setError("");
    setStorageError("");
  }

  async function handleGenerate() {
    if (pending || saving) {
      return;
    }
    if (prompt.trim().length < 8) {
      setError("Describe the form in a bit more detail.");
      return;
    }
    const reduceMotion = prefersReducedMotion();
    flushSync(() => {
      setPending(true);
      setError("");
    });
    stageRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    trackFunnel("generation_started", { page: "/" });
    try {
      const result = await generateAction(prompt);
      if (result.error || !result.spec) {
        setError(result.error ?? "Could not generate that form.");
        return;
      }
      setSpec(result.spec);
      trackFunnel("generation_succeeded", { page: "/" });
      setStorageError(storePendingSpec(result.spec) ? "" : "Browser storage is unavailable. Keep this page open to preserve your work.");
    } catch {
      setError("Could not generate the form. Your draft is still here; try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleSave() {
    if (!spec || saving) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const session = await authClient.getSession();
      if (session.error) {
        throw new Error("Could not check your account. Try again.");
      }
      const authenticated = Boolean(session.data?.user);
      const properties = { page: "/", authenticated, referrer: currentReferrer() };
      trackFunnel("customize_clicked", properties);
      if (authenticated) {
        const saved = await saveForm(spec);
        trackFunnel("form_created", properties);
        clearBrowserDraft();
        router.push(`/forms/${saved.id}`);
        return;
      }
      if (!storePendingSpec(spec)) {
        throw new Error("Allow browser storage before continuing so your draft can be saved after signup.");
      }
      router.push("/sign-up");
    } catch (caught) {
      setSaving(false);
      setError(caught instanceof Error ? caught.message : "Could not save the form.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      {!spec && storedDraft.spec ? (
        <div className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:rounded-2xl sm:p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">You have an unfinished form</p>
            <p className="truncate text-sm text-muted-foreground">{storedDraft.spec.title}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className="h-11 rounded-full" onClick={resumeDraft} disabled={pending || saving}>Resume your draft</Button>
            <Button type="button" variant="ghost" className="h-11 rounded-full" onClick={startOver} disabled={pending || saving}>Start over</Button>
          </div>
        </div>
      ) : null}
      {storageError ? <p role="status" className="text-sm text-muted-foreground">{storageError}</p> : null}
      <AnimateHeight>
        <div className="rounded-2xl bg-foreground/5 p-1.5 sm:rounded-[2rem]">
          <div className="flex flex-col rounded-xl bg-card p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:rounded-[calc(2rem-0.375rem)]">
            <Textarea
              aria-label="What form do you need?"
              className="min-h-28 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 sm:min-h-36"
              placeholder="Describe the form you need"
              value={prompt}
              onChange={(event) => updatePrompt(event.target.value)}
              disabled={pending || saving}
            />
            <div className="pt-2">
              <Button
                type="button"
                className="h-11 w-full rounded-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
                onClick={() => void handleGenerate()}
                disabled={pending || saving}
              >
                {pending ? "Generating" : "Generate"}
              </Button>
            </div>
            <div id="prompt-ideas" className="grid grid-cols-2 gap-2 pt-3 sm:flex sm:flex-wrap sm:px-1">
              {promptPresets.map((preset, index) => (
                <Button key={preset.label} type="button" variant="outline" className={`rounded-full px-2 text-[13px] sm:px-2.5 sm:text-sm ${index > 2 && !showAllPresets ? "hidden sm:inline-flex" : ""}`} onClick={() => updatePrompt(preset.prompt)} disabled={pending || saving}>
                  {preset.label}
                </Button>
              ))}
              <Button type="button" variant="ghost" className="rounded-full px-2 text-[13px] sm:hidden" aria-expanded={showAllPresets} aria-controls="prompt-ideas" onClick={() => setShowAllPresets((visible) => !visible)} disabled={pending || saving}>
                {showAllPresets ? "Fewer ideas" : "More ideas"}
              </Button>
            </div>
          </div>
        </div>
      </AnimateHeight>
      <AnimateHeight>
        {error ? <p role="alert" className="text-center text-sm text-destructive">{error}</p> : null}
      </AnimateHeight>
      <div ref={stageRef}>
        <AnimateHeight>
          {pending ? (
            <div className="animate-in fade-in duration-300">
              <GeneratingMark />
              <p className="sr-only" role="status">
                Generating your form
              </p>
            </div>
          ) : spec ? (
            <div className="rounded-2xl bg-foreground/5 p-1.5 sm:rounded-[2rem]">
              <div className="rounded-xl bg-card p-2 sm:rounded-[calc(2rem-0.375rem)] sm:p-6">
                  <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-500">
                    <FormView spec={spec} preview />
                    <Button type="button" variant="outline" className="h-11 w-full rounded-full" onClick={() => void handleSave()} disabled={saving}>
                      {saving ? "Saving" : "Save & customize"}
                    </Button>
                  </div>
              </div>
            </div>
          ) : null}
        </AnimateHeight>
      </div>
    </div>
  );
}
