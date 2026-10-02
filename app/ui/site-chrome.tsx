import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Logo } from "@/app/ui/logo";
import { MobileNavigation } from "@/app/ui/mobile-navigation";

export async function SiteHeader() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <header className="sticky top-[env(safe-area-inset-top)] z-40 mx-auto flex w-full max-w-5xl items-center justify-between gap-3 border-b bg-background px-4 py-2 sm:static sm:border-0 sm:py-5">
      <Link href="/" className="inline-flex min-h-11 shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="FormSquid home">
        <Logo priority className="h-6 sm:h-7" />
      </Link>
      <nav aria-label="Main navigation" className="hidden items-center gap-5 text-sm text-muted-foreground sm:flex">
        <Link href="/templates" className="transition-colors duration-300 hover:text-foreground">
          Templates
        </Link>
        <Link href="/shadcn/form-builder" className="transition-colors duration-300 hover:text-foreground">
          shadcn
        </Link>
        {session?.user ? (
          <>
            <Link href="/forms" className="transition-colors duration-300 hover:text-foreground">
              My forms
            </Link>
            <Link href="/account" className="transition-colors duration-300 hover:text-foreground">
              Account
            </Link>
          </>
        ) : (
          <Link href="/sign-in" className="transition-colors duration-300 hover:text-foreground">
            Sign in
          </Link>
        )}
      </nav>
      <MobileNavigation authenticated={Boolean(session?.user)} />
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <p>Generate it. Host it. Own the code.</p>
      <nav className="flex flex-wrap items-center gap-x-4" aria-label="Legal">
        <Link href="/privacy" className="inline-flex min-h-11 items-center transition-colors duration-300 hover:text-foreground">
          Privacy Policy
        </Link>
        <Link href="/terms" className="inline-flex min-h-11 items-center transition-colors duration-300 hover:text-foreground">
          Terms of Service
        </Link>
        <Link href="/" className="inline-flex min-h-11 items-center" aria-label="FormSquid home">
          <Logo className="h-5" />
        </Link>
      </nav>
    </footer>
  );
}
