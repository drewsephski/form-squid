export const submissionEvents = [
  "submission.accepted",
  "submission.invalid",
  "submission.rate_limited",
  "submission.not_found",
  "submission.failed",
] as const;

export type SubmissionEvent = (typeof submissionEvents)[number];

export function submissionLog(entry: {
  event: SubmissionEvent;
  requestId: string;
  formId: string | null;
  durationMs: number;
  status: number;
  reason: string;
}) {
  return JSON.stringify({
    event: entry.event,
    requestId: entry.requestId,
    formId: entry.formId,
    durationMs: entry.durationMs,
    status: entry.status,
    reason: entry.reason,
  });
}
