import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/app/ui/logo";

export const metadata: Metadata = {
  title: "Page not found · FormSquid",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <Logo className="mb-8 h-7" />
      <h1 className="font-heading text-2xl font-medium tracking-tight">Page not found.</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This page does not exist, or the form is no longer published.
      </p>
      <Link href="/" className={`${buttonVariants()} mt-6`}>
        Back to FormSquid
      </Link>
    </main>
  );
}
