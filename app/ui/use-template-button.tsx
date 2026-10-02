"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimateHeight } from "@/components/ui/animate-height";
import { Button } from "@/components/ui/button";
import { saveForm } from "@/app/lib/actions/forms-write";
import { currentReferrer, trackFunnel, type FunnelProperties } from "@/app/lib/analytics";
import { type FormSpec } from "@/app/lib/definitions";
import { storeDraftPrompt, storePendingSpec } from "@/app/lib/browser-draft";
import { authClient } from "@/lib/auth-client";

interface UseTemplateButtonProps extends FunnelProperties {
  spec: FormSpec;
  label?: string;
  intent?: "customize" | "template";
}

export function UseTemplateButton({
  spec,
  label = "Use this template",
  intent = "template",
  page,
  templateSlug,
  shadcnSlug,
}: UseTemplateButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleUse() {
    if (pending) {
      return;
    }
    setPending(true);
    setError("");
    try {
      const session = await authClient.getSession();
      if (session.error) {
        throw new Error("Could not check your account. Try again.");
      }
      const authenticated = Boolean(session.data?.user);
      const properties = { page, templateSlug, shadcnSlug, authenticated, referrer: currentReferrer() };
      trackFunnel(intent === "customize" ? "customize_clicked" : "template_used", properties);
      if (authenticated) {
        const saved = await saveForm(spec);
        trackFunnel("form_created", properties);
        router.push(`/forms/${saved.id}`);
        return;
      }
      if (!storePendingSpec(spec)) {
        throw new Error("Allow browser storage before continuing so your template can be saved after signup.");
      }
      storeDraftPrompt("");
      router.push("/sign-up");
    } catch (caught) {
      setPending(false);
      setError(caught instanceof Error ? caught.message : "Could not create the form.");
    }
  }

  return (
    <AnimateHeight>
      <div className="space-y-2">
        <Button type="button" className="h-11 rounded-full px-6" onClick={() => void handleUse()} disabled={pending}>
          {pending ? "Creating form" : label}
        </Button>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      </div>
    </AnimateHeight>
  );
}
