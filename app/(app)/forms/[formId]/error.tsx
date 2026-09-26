"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function FormEditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="font-heading text-2xl font-medium tracking-tight">Couldn&apos;t load this form.</h1>
      <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try again or go back to your forms.</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={reset}>
          Try again
        </Button>
        <Link href="/forms" className={buttonVariants({ variant: "outline" })}>
          Back to my forms
        </Link>
      </div>
    </main>
  );
}
