import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
      <Link href="/" className="font-heading text-xl tracking-tight" aria-label="FormSquid home">
        FormSquid
      </Link>
      <nav className="flex items-center gap-5 text-sm text-muted-foreground">
        <Link href="/sign-in" className="transition-colors duration-300 hover:text-foreground">
          Sign in
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 text-xs text-muted-foreground">
      <p>Generate it. Host it. Own the code.</p>
      <p>FormSquid</p>
    </footer>
  );
}
