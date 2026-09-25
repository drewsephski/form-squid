/** Product plan placeholders — swap per entitlement later. No billing yet. */
export const freePlanLimits = {
  maxFileSizeMb: 10,
  maxFilesPerSubmission: 5,
  maxTotalStorageMb: 250,
} as const;

/** Hard technical abuse ceilings — independent of product plans. */
export const abuseCeilings = {
  maxFileSizeMb: 25,
  maxFilesPerField: 5,
  maxFilenameBytes: 200,
  maxUploadAuthPerMinute: 60,
  pendingUploadTtlHours: 24,
  downloadUrlExpiresInSeconds: 120,
  uploadUrlExpiresInSeconds: 15 * 60,
} as const;

export const submissionUploadsBucket = "submission-uploads";

/**
 * Default MIME allowlist when a file field omits `accept`.
 * Office formats are omitted until V1 can verify them by content (not Content-Type alone).
 */
export const defaultAcceptMimeTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
] as const;

export function effectiveMaxFileSizeMb(configuredMb?: number) {
  const product = configuredMb ?? freePlanLimits.maxFileSizeMb;
  return Math.min(product, freePlanLimits.maxFileSizeMb, abuseCeilings.maxFileSizeMb);
}

export function effectiveMaxFiles(configured?: 1 | 5) {
  const value = configured === 5 ? 5 : 1;
  return Math.min(value, freePlanLimits.maxFilesPerSubmission, abuseCeilings.maxFilesPerField);
}

export function maxFileSizeBytes(configuredMb?: number) {
  return effectiveMaxFileSizeMb(configuredMb) * 1024 * 1024;
}
