export type LaunchTab = "submissions" | "integrations" | "code";

export type LaunchStepId =
  | "share"
  | "notifications"
  | "webhook"
  | "source"
  | "firstResponse";

export interface LaunchStepsInput {
  published: boolean;
  notifyEmail: string;
  webhookEnabled: boolean;
  submissionCount: number;
}

export interface LaunchStep {
  id: LaunchStepId;
  title: string;
  description: string;
  complete: boolean;
  /** Tab to open for the action, if any. */
  tab?: LaunchTab;
  /** Whether the step is purely informational once complete (no further action needed). */
  actionLabel?: string;
}

export interface LaunchState {
  /** Only show the checklist after the form has been published. */
  visible: boolean;
  /** Soften the checklist once the product loop has a response. */
  collecting: boolean;
  steps: LaunchStep[];
  completedCount: number;
}

export function deriveLaunchState(input: LaunchStepsInput): LaunchState {
  if (!input.published) {
    return {
      visible: false,
      collecting: false,
      steps: [],
      completedCount: 0,
    };
  }

  const notifyComplete = input.notifyEmail.trim().length > 0;
  const webhookComplete = input.webhookEnabled;
  const firstResponseComplete = input.submissionCount > 0;

  const steps: LaunchStep[] = [
    {
      id: "share",
      title: "Share your form",
      description: "Copy the live link or open the hosted form.",
      complete: true,
      actionLabel: "Copy link",
    },
    {
      id: "notifications",
      title: "Receive notifications",
      description: "Get an email when someone submits.",
      complete: notifyComplete,
      tab: "submissions",
      actionLabel: notifyComplete ? undefined : "Add email",
    },
    {
      id: "webhook",
      title: "Connect your backend",
      description: "Send submissions to your own endpoint.",
      complete: webhookComplete,
      tab: "integrations",
      actionLabel: webhookComplete ? undefined : "Set up webhook",
    },
    {
      id: "source",
      title: "Use the source",
      description: "Install or copy the generated shadcn form.",
      complete: false,
      tab: "code",
      actionLabel: "View code",
    },
    {
      id: "firstResponse",
      title: "Get your first response",
      description: firstResponseComplete
        ? "You are collecting responses."
        : "Open the live form and submit a test response.",
      complete: firstResponseComplete,
      actionLabel: firstResponseComplete ? undefined : "Open live form",
    },
  ];

  const completedCount = steps.filter((step) => step.complete).length;

  return {
    visible: true,
    collecting: firstResponseComplete,
    steps,
    completedCount,
  };
}
