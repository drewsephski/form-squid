"use client";

import type { FormSpec } from "@/app/lib/definitions";
import { FormView } from "@/app/ui/form-view";
import { cn } from "@/lib/utils";

const sizes = {
  card: { height: "h-64", scale: 0.42 },
  thumb: { height: "h-28", scale: 0.36 },
} as const;

export function FormMiniPreview({
  spec,
  previewId = "preview",
  size = "card",
  className,
}: {
  spec: FormSpec;
  /** Unique id so multiple card previews do not clash on field ids. */
  previewId?: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const { height, scale } = sizes[size];

  return (
    <div className={cn("relative overflow-hidden rounded-xl border bg-muted/30", height, className)} aria-hidden="true" inert>
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 p-2"
        style={{
          width: `${100 / scale}%`,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <FormView spec={spec} preview compact idPrefix={`${previewId}-`} />
      </div>
    </div>
  );
}
