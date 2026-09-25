import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { Logo } from "@/app/ui/logo";

export async function SiteHeader() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-5">
      <Link href="/" className="shrink-0" aria-label="FormSquid home">
        <Logo priority className="h-6 sm:h-7" />
      </Link>
      <nav className="flex items-center gap-5 text-sm text-muted-foreground">
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
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 text-xs text-muted-foreground">
      <p>Generate it. Host it. Own the code.</p>
      <Link href="/" aria-label="FormSquid home">
        <Logo className="h-5" />
      </Link>
    </footer>
  );
}
