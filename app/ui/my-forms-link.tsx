"use client";

import Link from "next/link";
import { useRef } from "react";
import { ArrowLeftIcon, type ArrowLeftIconHandle } from "@/components/icons/arrow-left";

export function MyFormsLink() {
  const icon = useRef<ArrowLeftIconHandle>(null);

  function animate() {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      icon.current?.startAnimation();
    }
  }

  function reset() {
    icon.current?.stopAnimation();
  }

  return (
    <Link
      href="/forms"
      className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      onMouseEnter={animate}
      onMouseLeave={reset}
      onFocus={animate}
      onBlur={reset}
    >
      <ArrowLeftIcon ref={icon} size={16} className="shrink-0" aria-hidden="true" />
      My forms
    </Link>
  );
}
