import type { ReactNode } from "react";

export default function PublicFormLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="px-4 py-6 text-center text-xs text-muted-foreground">
        <a href="https://formsquid.com" className="underline-offset-4 hover:underline">
          Made with FormSquid
        </a>
      </footer>
    </>
  );
}
