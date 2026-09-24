import type { FormSpec, SubmissionResult } from "./definitions";
import { validatePayload } from "./submission-algorithm";

export function validateSubmission(
  spec: FormSpec,
  payload: unknown,
  options?: { stepId?: string },
): SubmissionResult {
  return validatePayload(spec, payload, options?.stepId);
}
