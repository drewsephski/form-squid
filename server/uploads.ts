import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, lt, notInArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import {
  formSpecSchema,
  type FormSpec,
  type SubmissionData,
  type SubmissionFileRef,
  type SubmissionValue,
} from "../app/lib/definitions";
import {
  fileFieldSettings,
  isUploadId,
  mimeAllowed,
  sanitizeDisplayFilename,
} from "../app/lib/file-field";
import { abuseCeilings, freePlanLimits, maxFileSizeBytes } from "../app/lib/upload-limits";
import * as schema from "../db/schema";
import { formVersions, forms, submissionFiles, submissions } from "../db/schema";
import { isVerifiableContentType, verifyContentMatchesType } from "./content-verify";
import { reserveSubmissionAttempt } from "./rate-limit";
import {
  createSignedDownload,
  createSignedUpload,
  deleteStoredObject,
  headStoredObject,
  opaqueStorageKey,
  readStoredObjectPrefix,
} from "./storage";

export type UploadDatabase = NodePgDatabase<typeof schema> | NeonDatabase<typeof schema>;

export type PreparedUploadClaim = {
  uploadId: string;
  fieldId: string;
  verifiedSize: number;
  contentType: string;
  name: string;
};

export type PrepareUploadsResult =
  | { ok: true; data: SubmissionData; claims: PreparedUploadClaim[] }
  | { ok: false; errors: { path: string; message: string }[] };

function fieldsById(spec: FormSpec) {
  return new Map(spec.steps.flatMap((step) => step.fields).map((field) => [field.id, field]));
}

async function publishedSpec(database: UploadDatabase, slug: string) {
  const [form] = await database.select().from(forms).where(eq(forms.slug, slug));
  if (!form?.currentPublishedVersionId) {
    return null;
  }
  const [version] = await database
    .select()
    .from(formVersions)
    .where(eq(formVersions.id, form.currentPublishedVersionId));
  if (!version) {
    return null;
  }
  return { form, version, spec: formSpecSchema.parse(version.spec) };
}

export type AuthorizeUploadResult =
  | {
      ok: true;
      status: 200;
      body: {
        uploadId: string;
        upload:
          | { method: "PUT"; url: string; headers?: Record<string, string> }
          | { method: "POST"; url: string; fields: Record<string, string> };
      };
    }
  | { ok: false; status: 400 | 404 | 429; body: { ok: false; error: string }; retryAfter?: number };

export async function authorizeUpload(
  database: UploadDatabase,
  input: {
    slug: string;
    actorHash: string;
    fieldId: string;
    filename: string;
    contentType: string;
    size: number;
    now?: Date;
  },
): Promise<AuthorizeUploadResult> {
  const now = input.now ?? new Date();
  const published = await publishedSpec(database, input.slug);
  if (!published) {
    return { ok: false, status: 404, body: { ok: false, error: "Form not found." } };
  }

  const rate = await reserveSubmissionAttempt(database, {
    formId: published.form.id,
    actorHash: `upload:${input.actorHash}`,
    now,
    maxAttempts: abuseCeilings.maxUploadAuthPerMinute,
  });
  if (!rate.allowed) {
    return {
      ok: false,
      status: 429,
      body: { ok: false, error: "Too many upload attempts. Try again in a minute." },
      retryAfter: rate.retryAfter,
    };
  }

  const field = fieldsById(published.spec).get(input.fieldId);
  if (!field || field.type !== "file") {
    return { ok: false, status: 400, body: { ok: false, error: "Unknown file field." } };
  }

  const settings = fileFieldSettings(field);
  const contentType = input.contentType.trim().toLowerCase();
  if (!mimeAllowed(contentType, settings.accept)) {
    return { ok: false, status: 400, body: { ok: false, error: "This file type is not allowed." } };
  }
  if (!isVerifiableContentType(contentType)) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, error: "This file type cannot be verified yet." },
    };
  }
  if (!Number.isFinite(input.size) || input.size <= 0 || input.size > settings.maxFileSizeBytes) {
    return {
      ok: false,
      status: 400,
      body: { ok: false, error: `File must be ${settings.maxFileSizeMb} MB or smaller.` },
    };
  }

  // Pending rows count toward quota conservatively using the declared size.
  const [usage] = await database
    .select({ total: sql<number>`coalesce(sum(${submissionFiles.sizeBytes}), 0)::int` })
    .from(submissionFiles)
    .where(eq(submissionFiles.formId, published.form.id));
  if ((usage?.total ?? 0) + input.size > freePlanLimits.maxTotalStorageMb * 1024 * 1024) {
    return { ok: false, status: 400, body: { ok: false, error: "Storage limit reached for this form." } };
  }

  const uploadId = randomUUID();
  const storageKey = opaqueStorageKey(published.form.id, uploadId);
  const filename = sanitizeDisplayFilename(input.filename, abuseCeilings.maxFilenameBytes);

  await database.insert(submissionFiles).values({
    id: uploadId,
    formId: published.form.id,
    submissionId: null,
    fieldId: field.id,
    storageKey,
    originalFilename: filename,
    contentType,
    sizeBytes: Math.floor(input.size),
    actorHash: input.actorHash,
    createdAt: now,
  });

  const upload = await createSignedUpload({
    storageKey,
    contentType,
    maxSize: settings.maxFileSizeBytes,
  });

  return { ok: true, status: 200, body: { uploadId, upload } };
}

function collectUploadIds(value: SubmissionValue | undefined): string[] {
  if (value === undefined) {
    return [];
  }
  if (typeof value === "string") {
    return isUploadId(value) ? [value] : [];
  }
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value.filter(isUploadId);
  }
  return [];
}

async function rejectInvalidPendingObject(storageKey: string) {
  try {
    await deleteStoredObject(storageKey);
  } catch (error) {
    console.error("invalid pending upload object delete failed", storageKey, error);
  }
}

/**
 * Validate pending uploads and verify stored object metadata/content.
 * Does not mutate submission_id — call claimUploadsForSubmission after INSERT.
 */
export async function prepareUploadsForSubmission(
  database: UploadDatabase,
  input: {
    formId: string;
    actorHash: string;
    spec: FormSpec;
    data: SubmissionData;
  },
): Promise<PrepareUploadsResult> {
  const fieldMap = fieldsById(input.spec);
  const errors: { path: string; message: string }[] = [];
  const nextData: SubmissionData = { ...input.data };
  const claims: PreparedUploadClaim[] = [];

  let totalFiles = 0;
  for (const [fieldId, value] of Object.entries(input.data)) {
    const field = fieldMap.get(fieldId);
    if (!field || field.type !== "file") {
      continue;
    }
    const uploadIds = collectUploadIds(value);
    totalFiles += uploadIds.length;
    if (uploadIds.length === 0) {
      delete nextData[fieldId];
      continue;
    }

    const settings = fileFieldSettings(field);
    if (uploadIds.length > settings.maxFiles) {
      errors.push({
        path: fieldId,
        message: settings.maxFiles === 1 ? "Upload one file." : `Upload up to ${settings.maxFiles} files.`,
      });
      continue;
    }

    const rows = await database
      .select()
      .from(submissionFiles)
      .where(and(inArray(submissionFiles.id, uploadIds), eq(submissionFiles.formId, input.formId)));

    const byId = new Map(rows.map((row) => [row.id, row]));
    const refs: SubmissionFileRef[] = [];

    for (const uploadId of uploadIds) {
      const row = byId.get(uploadId);
      if (!row || row.submissionId || row.actorHash !== input.actorHash || row.fieldId !== fieldId) {
        errors.push({ path: fieldId, message: "Upload is not available for this form." });
        break;
      }
      if (!mimeAllowed(row.contentType, settings.accept) || !isVerifiableContentType(row.contentType)) {
        errors.push({ path: fieldId, message: "This file type is not allowed." });
        break;
      }

      const meta = await headStoredObject(row.storageKey);
      if (!meta) {
        errors.push({ path: fieldId, message: "Upload is incomplete. Try uploading again." });
        break;
      }
      if (meta.size <= 0) {
        await rejectInvalidPendingObject(row.storageKey);
        errors.push({ path: fieldId, message: "Upload is incomplete. Try uploading again." });
        break;
      }
      if (meta.size > settings.maxFileSizeBytes) {
        await rejectInvalidPendingObject(row.storageKey);
        errors.push({ path: fieldId, message: `File must be ${settings.maxFileSizeMb} MB or smaller.` });
        break;
      }
      if (meta.size !== row.sizeBytes) {
        await rejectInvalidPendingObject(row.storageKey);
        errors.push({ path: fieldId, message: "Uploaded file size does not match the authorized size." });
        break;
      }
      const actualType = meta.contentType;
      if (!actualType || actualType !== row.contentType) {
        await rejectInvalidPendingObject(row.storageKey);
        errors.push({ path: fieldId, message: "Uploaded file type does not match the authorized type." });
        break;
      }
      if (!mimeAllowed(actualType, settings.accept)) {
        await rejectInvalidPendingObject(row.storageKey);
        errors.push({ path: fieldId, message: "This file type is not allowed." });
        break;
      }

      const prefix = await readStoredObjectPrefix(row.storageKey);
      if (!prefix) {
        errors.push({ path: fieldId, message: "Upload is incomplete. Try uploading again." });
        break;
      }
      const contentCheck = verifyContentMatchesType(actualType, prefix);
      if (!contentCheck.ok) {
        await rejectInvalidPendingObject(row.storageKey);
        errors.push({ path: fieldId, message: contentCheck.reason });
        break;
      }

      refs.push({
        id: row.id,
        name: row.originalFilename,
        contentType: actualType,
        size: meta.size,
      });
      claims.push({
        uploadId: row.id,
        fieldId,
        verifiedSize: meta.size,
        contentType: actualType,
        name: row.originalFilename,
      });
    }

    if (errors.some((error) => error.path === fieldId)) {
      continue;
    }

    nextData[fieldId] = settings.maxFiles === 1 ? refs[0]! : refs;
  }

  if (totalFiles > freePlanLimits.maxFilesPerSubmission) {
    errors.push({ path: "", message: `A submission can include at most ${freePlanLimits.maxFilesPerSubmission} files.` });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  if (claims.length > 0) {
    const claimIds = claims.map((claim) => claim.uploadId);
    const verifiedTotal = claims.reduce((sum, claim) => sum + claim.verifiedSize, 0);
    const [otherUsage] = await database
      .select({ total: sql<number>`coalesce(sum(${submissionFiles.sizeBytes}), 0)::int` })
      .from(submissionFiles)
      .where(and(eq(submissionFiles.formId, input.formId), notInArray(submissionFiles.id, claimIds)));
    if ((otherUsage?.total ?? 0) + verifiedTotal > freePlanLimits.maxTotalStorageMb * 1024 * 1024) {
      return { ok: false, errors: [{ path: "", message: "Storage limit reached for this form." }] };
    }
  }

  return { ok: true, data: nextData, claims };
}

/**
 * Claim pending uploads after the submissions row exists.
 * Concurrency-safe: only rows with submission_id IS NULL are claimed.
 */
export async function claimUploadsForSubmission(
  database: UploadDatabase,
  input: {
    formId: string;
    submissionId: string;
    actorHash: string;
    claims: PreparedUploadClaim[];
  },
) {
  if (input.claims.length === 0) {
    return;
  }

  const expectedIds = [...new Set(input.claims.map((claim) => claim.uploadId))].sort();

  // Persist verified sizes before the claim UPDATE so permanent metadata matches storage.
  for (const claim of input.claims) {
    await database
      .update(submissionFiles)
      .set({
        sizeBytes: claim.verifiedSize,
        contentType: claim.contentType,
      })
      .where(
        and(
          eq(submissionFiles.id, claim.uploadId),
          eq(submissionFiles.formId, input.formId),
          eq(submissionFiles.actorHash, input.actorHash),
          isNull(submissionFiles.submissionId),
        ),
      );
  }

  const claimed = await database
    .update(submissionFiles)
    .set({ submissionId: input.submissionId })
    .where(
      and(
        inArray(submissionFiles.id, expectedIds),
        eq(submissionFiles.formId, input.formId),
        eq(submissionFiles.actorHash, input.actorHash),
        isNull(submissionFiles.submissionId),
      ),
    )
    .returning({ id: submissionFiles.id });

  const claimedIds = claimed.map((row) => row.id).sort();
  if (claimedIds.length !== expectedIds.length || claimedIds.some((id, index) => id !== expectedIds[index])) {
    throw Object.assign(new Error("upload_claim_failed"), {
      errors: [{ path: "", message: "Upload is not available for this form." }],
    });
  }
}

/** @deprecated Prefer prepareUploadsForSubmission + claimUploadsForSubmission inside a transaction. */
export async function attachUploadsToSubmission(
  database: UploadDatabase,
  input: {
    formId: string;
    submissionId: string;
    actorHash: string;
    spec: FormSpec;
    data: SubmissionData;
  },
): Promise<{ ok: true; data: SubmissionData } | { ok: false; errors: { path: string; message: string }[] }> {
  const prepared = await prepareUploadsForSubmission(database, input);
  if (!prepared.ok) {
    return prepared;
  }
  await claimUploadsForSubmission(database, {
    formId: input.formId,
    submissionId: input.submissionId,
    actorHash: input.actorHash,
    claims: prepared.claims,
  });
  return { ok: true, data: prepared.data };
}

export async function purgeStalePendingUploads(database: UploadDatabase, now = new Date()) {
  const cutoff = new Date(now.getTime() - abuseCeilings.pendingUploadTtlHours * 60 * 60 * 1000);
  const stale = await database
    .select()
    .from(submissionFiles)
    .where(and(isNull(submissionFiles.submissionId), lt(submissionFiles.createdAt, cutoff)))
    .limit(200);

  let deleted = 0;
  for (const row of stale) {
    try {
      await deleteStoredObject(row.storageKey);
    } catch (error) {
      // Tolerate already-missing objects; still remove the pending DB row.
      console.error("stale upload object delete failed", row.id, error);
    }
    const removed = await database
      .delete(submissionFiles)
      .where(and(eq(submissionFiles.id, row.id), isNull(submissionFiles.submissionId)))
      .returning({ id: submissionFiles.id });
    if (removed.length > 0) {
      deleted += 1;
    }
  }
  return deleted;
}

export async function signedDownloadForOwner(
  database: UploadDatabase,
  input: { formId: string; userId: string; fileId: string },
) {
  const [form] = await database
    .select()
    .from(forms)
    .where(and(eq(forms.id, input.formId), eq(forms.userId, input.userId)));
  if (!form) {
    return null;
  }

  const [file] = await database
    .select()
    .from(submissionFiles)
    .where(and(eq(submissionFiles.id, input.fileId), eq(submissionFiles.formId, input.formId)));
  if (!file?.submissionId) {
    return null;
  }

  const [submission] = await database
    .select()
    .from(submissions)
    .where(and(eq(submissions.id, file.submissionId), eq(submissions.formId, input.formId)));
  if (!submission) {
    return null;
  }

  const url = await createSignedDownload({
    storageKey: file.storageKey,
    filename: file.originalFilename,
  });
  return { url, filename: file.originalFilename, contentType: file.contentType };
}

export { maxFileSizeBytes };
