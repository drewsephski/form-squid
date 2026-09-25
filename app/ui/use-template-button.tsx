"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { saveForm } from "@/app/lib/actions/forms-write";
import { pendingSpecKey, type FormSpec } from "@/app/lib/definitions";
import { authClient } from "@/lib/auth-client";

interface UseTemplateButtonProps {
  spec: FormSpec;
  label?: string;
}

export function UseTemplateButton({ spec, label = "Use this template" }: UseTemplateButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function handleUse() {
    setPending(true);
    setError("");
    const session = await authClient.getSession();
    if (session.data?.user) {
      try {
        const saved = await saveForm(spec);
        router.push(`/forms/${saved.id}`);
        return;
      } catch (caught) {
        setPending(false);
        setError(caught instanceof Error ? caught.message : "Could not create the form.");
        return;
      }
    }

    window.localStorage.setItem(pendingSpecKey, JSON.stringify(spec));
    router.push("/sign-up");
  }

  return (
    <div className="space-y-2">
      <Button type="button" className="h-11 rounded-full px-6" onClick={() => void handleUse()} disabled={pending}>
        {pending ? "Creating form" : label}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
