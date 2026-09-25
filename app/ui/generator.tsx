"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimateHeight } from "@/components/ui/animate-height";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateAction } from "@/app/lib/actions/generate";
import { saveForm } from "@/app/lib/actions/forms-write";
import { currentReferrer, trackFunnel } from "@/app/lib/analytics";
import { pendingSpecKey, type FormSpec } from "@/app/lib/definitions";
import { promptPresets } from "@/app/lib/prompt-presets";
import { FormView } from "@/app/ui/form-view";
import { authClient } from "@/lib/auth-client";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function GeneratingMark() {
  return (
    <div className="flex aspect-video w-full items-center justify-center" aria-hidden="true">
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
    </div>
  );
}

export function Generator() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [spec, setSpec] = useState<FormSpec | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  async function handleGenerate() {
    const reduceMotion = prefersReducedMotion();
    flushSync(() => {
      setPending(true);
      setError("");
    });
    stageRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    trackFunnel("generation_started", { page: "/" });
    const result = await generateAction(prompt);
    setPending(false);
    if (result.error || !result.spec) {
      setError(result.error ?? "Could not generate that form.");
      return;
    }
    setSpec(result.spec);
    trackFunnel("generation_succeeded", { page: "/" });
    window.localStorage.setItem(pendingSpecKey, JSON.stringify(result.spec));
  }

  async function handleSave() {
    if (!spec || saving) {
      return;
    }
    setSaving(true);
    setError("");
    const session = await authClient.getSession();
    const authenticated = Boolean(session.data?.user);
    const properties = { page: "/", authenticated, referrer: currentReferrer() };
    trackFunnel("customize_clicked", properties);
    if (authenticated) {
      try {
        const saved = await saveForm(spec);
        trackFunnel("form_created", properties);
        window.localStorage.removeItem(pendingSpecKey);
        router.push(`/forms/${saved.id}`);
        return;
      } catch (caught) {
        setSaving(false);
        setError(caught instanceof Error ? caught.message : "Could not save the form.");
        return;
      }
    }
    window.localStorage.setItem(pendingSpecKey, JSON.stringify(spec));
    router.push("/sign-up");
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <AnimateHeight>
        <div className="rounded-[2rem] bg-foreground/5 p-1.5">
          <div className="rounded-[calc(2rem-0.375rem)] bg-card p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <Textarea
              aria-label="What form do you need?"
              className="min-h-36 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
              placeholder="Describe the form you need"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <div className="flex flex-wrap gap-2 px-1 pt-2">
              {promptPresets.map((preset) => (
                <Button key={preset.label} type="button" variant="outline" className="rounded-full" onClick={() => setPrompt(preset.prompt)}>
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="pt-2">
              <Button
                type="button"
                className="h-11 w-full rounded-full transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]"
                onClick={() => void handleGenerate()}
                disabled={pending}
              >
                {pending ? "Generating" : "Generate"}
              </Button>
            </div>
          </div>
        </div>
      </AnimateHeight>
      <AnimateHeight>
        {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
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
          ) : (
            <div className="rounded-[2rem] bg-foreground/5 p-1.5">
              <div className="rounded-[calc(2rem-0.375rem)] bg-card p-6">
                {spec ? (
                  <div className="animate-in fade-in slide-in-from-bottom-2 space-y-6 duration-500">
                    <FormView spec={spec} preview />
                    <Button type="button" variant="outline" className="h-11 w-full rounded-full" onClick={() => void handleSave()} disabled={saving}>
                      {saving ? "Saving" : "Save & customize"}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
                    <p>Describe your form above</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </AnimateHeight>
      </div>
    </div>
  );
}
