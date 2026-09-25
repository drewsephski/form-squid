import type { ReactNode } from "react";
import { Logo } from "@/app/ui/logo";

export default function PublicFormLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="px-4 py-6 text-center text-xs text-muted-foreground">
        <a
          href="https://formsquid.com"
          className="inline-flex items-center gap-2 underline-offset-4 hover:text-foreground"
        >
          Made with
          <Logo className="h-5" />
        </a>
      </footer>
    </>
  );
}
