"use client";

import { Button } from "@/components/ui/button";
import type { LaunchState, LaunchStep, LaunchTab } from "@/app/lib/launch-steps";

interface LaunchChecklistProps {
  state: LaunchState;
  onCopyLink: () => void;
  onOpenLive: () => void;
  onGoToTab: (tab: LaunchTab, options?: { focusNotifyEmail?: boolean }) => void;
}

function StepRow({
  step,
  onAction,
}: {
  step: LaunchStep;
  onAction: () => void;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-2.5">
      <div className="min-w-0 space-y-0.5">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span
            className={`inline-block size-1.5 shrink-0 rounded-full ${step.complete ? "bg-foreground" : "bg-muted-foreground/50"}`}
            aria-hidden="true"
          />
          <span className={step.complete ? "text-muted-foreground" : ""}>{step.title}</span>
          {step.complete ? (
            <span className="text-xs font-normal text-muted-foreground">Done</span>
          ) : null}
        </p>
        <p className="pl-3.5 text-sm text-muted-foreground">{step.description}</p>
      </div>
      {step.actionLabel ? (
        <Button type="button" variant="outline" size="sm" onClick={onAction}>
          {step.actionLabel}
        </Button>
      ) : null}
    </li>
  );
}

export function LaunchChecklist({ state, onCopyLink, onOpenLive, onGoToTab }: LaunchChecklistProps) {
  if (!state.visible) {
    return null;
  }

  if (state.collecting) {
    return (
      <section
        aria-label="Form status"
        className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3"
      >
        <p className="text-sm">
          <span className="mr-2 inline-block size-1.5 rounded-full bg-foreground align-middle" aria-hidden="true" />
          Live and collecting responses.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Launch your form" className="rounded-xl border px-4 py-4">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">Next steps</h2>
        <p className="text-xs text-muted-foreground">
          {state.completedCount} of {state.steps.length} ready
        </p>
      </div>
      <p className="mb-2 text-sm text-muted-foreground">
        Share the form, collect responses, then wire notifications or your own backend.
      </p>
      <ul className="divide-y">
        {state.steps.map((step) => (
          <StepRow
            key={step.id}
            step={step}
            onAction={() => {
              if (step.id === "share") {
                onCopyLink();
                return;
              }
              if (step.id === "firstResponse") {
                onOpenLive();
                return;
              }
              if (step.tab === "submissions") {
                onGoToTab("submissions", { focusNotifyEmail: true });
                return;
              }
              if (step.tab) {
                onGoToTab(step.tab);
              }
            }}
          />
        ))}
      </ul>
    </section>
  );
}
