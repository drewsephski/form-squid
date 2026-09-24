import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "@/app/ui/site-chrome";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </>
  );
}
