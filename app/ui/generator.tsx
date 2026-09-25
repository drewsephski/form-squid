"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateAction } from "@/app/lib/actions/generate";
import { trackFunnel } from "@/app/lib/analytics";
import { pendingSpecKey, type FormSpec } from "@/app/lib/definitions";
import { promptPresets } from "@/app/lib/prompt-presets";
import { FormView } from "@/app/ui/form-view";

export function Generator() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [spec, setSpec] = useState<FormSpec | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleGenerate() {
    setPending(true);
    setError("");
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

  function handleSave() {
    if (!spec) {
      return;
    }
    window.localStorage.setItem(pendingSpecKey, JSON.stringify(spec));
    router.push("/sign-up");
  }

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
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
      {error ? <p className="text-center text-sm text-destructive">{error}</p> : null}
      <div className="rounded-[2rem] bg-foreground/5 p-1.5">
        <div className="rounded-[calc(2rem-0.375rem)] bg-card p-6">
          {spec ? (
            <div className="space-y-6">
              <FormView spec={spec} preview />
              <Button type="button" variant="outline" className="h-11 w-full rounded-full" onClick={handleSave}>
                Save & customize
              </Button>
            </div>
          ) : (
            <div className="space-y-3 py-10 text-center text-muted-foreground">
              <p>Describe your form above</p>
              <div>
                <p>Try:</p>
                <ul>
                  {promptPresets.slice(0, 3).map((preset) => (
                    <li key={preset.label}>
                      <button type="button" className="underline underline-offset-4" onClick={() => setPrompt(preset.prompt)}>
                        {preset.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
