"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function MobileNavigation({ authenticated }: { authenticated: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const links = [
    { href: "/templates", label: "Templates" },
    { href: "/shadcn/form-builder", label: "shadcn source" },
    ...(authenticated
      ? [{ href: "/forms", label: "My forms" }, { href: "/account", label: "Account" }]
      : [{ href: "/sign-in", label: "Sign in" }]),
  ];

  return (
    <div className="flex items-center gap-1 sm:hidden">
      <Link
        href={authenticated ? "/forms" : "/sign-in"}
        className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {authenticated ? "My forms" : "Sign in"}
      </Link>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button type="button" variant="ghost" size="icon" className="size-11" aria-label="Open navigation" />}>
          <Menu aria-hidden="true" className="size-5" />
        </DialogTrigger>
        <DialogContent className="top-auto right-0 bottom-0 left-0 max-h-[85dvh] max-w-none translate-x-0 translate-y-0 gap-5 overflow-y-auto rounded-t-2xl rounded-b-none p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] data-open:zoom-in-100 data-closed:zoom-out-100 motion-reduce:animate-none">
          <DialogHeader className="pr-12">
            <DialogTitle className="text-2xl leading-tight">Explore FormSquid</DialogTitle>
            <DialogDescription>Build a form, browse templates, or get the source.</DialogDescription>
          </DialogHeader>
          <nav aria-label="Mobile navigation" className="grid gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className="flex min-h-12 items-center justify-between gap-4 rounded-lg px-3 text-base hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-[current=page]:bg-muted"
                onClick={() => setOpen(false)}
              >
                {link.label}
                <ArrowUpRight aria-hidden="true" className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </nav>
          <Link
            href="/"
            className="flex min-h-12 items-center justify-center rounded-full bg-primary px-5 text-base font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={() => setOpen(false)}
          >
            Create a form
          </Link>
        </DialogContent>
      </Dialog>
    </div>
  );
}
