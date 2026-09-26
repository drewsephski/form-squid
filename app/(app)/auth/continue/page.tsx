"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { continueAfterAuth } from "@/app/lib/continue-after-auth";
import { buttonVariants } from "@/components/ui/button";

export default function AuthContinuePage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    void continueAfterAuth({
      page: "/auth/continue",
      router,
      onError: setError,
    });
  }, [router]);

  if (error) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-8 text-center">
        <h1 className="font-heading text-3xl font-medium">Almost there</h1>
        <p className="text-sm text-destructive">{error}</p>
        <Link href="/forms" className={buttonVariants()}>
          Go to my forms
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 text-center">
      <p className="text-muted-foreground">Finishing sign-in…</p>
    </main>
  );
}
