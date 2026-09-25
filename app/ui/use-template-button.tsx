"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { pendingSpecKey, type FormSpec } from "@/app/lib/definitions";

export function UseTemplateButton({ spec }: { spec: FormSpec }) {
  const router = useRouter();

  function handleUse() {
    window.localStorage.setItem(pendingSpecKey, JSON.stringify(spec));
    router.push("/sign-up");
  }

  return (
    <Button type="button" className="h-11 rounded-full px-6" onClick={handleUse}>
      Use this template
    </Button>
  );
}
