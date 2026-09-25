"use client";

import type { FormSpec } from "@/app/lib/definitions";
import { FormView } from "@/app/ui/form-view";

const sizes = {
  card: { height: "h-48", scale: 0.55 },
  thumb: { height: "h-28", scale: 0.42 },
} as const;

export function FormMiniPreview({
  spec,
  previewId = "preview",
  size = "card",
}: {
  spec: FormSpec;
  /** Unique id so multiple card previews do not clash on field ids. */
  previewId?: string;
  size?: keyof typeof sizes;
}) {
  const { height, scale } = sizes[size];

  return (
    <div className={`relative ${height} overflow-hidden rounded-xl border bg-muted/30`} aria-hidden="true" inert>
      <div
        className="pointer-events-none origin-top-left p-3 sm:p-4"
        style={{
          width: `${100 / scale}%`,
          transform: `scale(${scale})`,
        }}
      >
        <FormView spec={spec} preview idPrefix={`${previewId}-`} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
