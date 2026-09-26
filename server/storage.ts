import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { abuseCeilings, submissionUploadsBucket } from "../app/lib/upload-limits";
import { contentDispositionAttachment } from "../app/lib/file-field";

/** S3 DeleteObjects accepts at most 1000 keys per request. */
const DELETE_OBJECTS_CHUNK_SIZE = 1000;

let cached: S3Client | null = null;

function s3Client() {
  if (!cached) {
    cached = new S3Client({
      forcePathStyle: true,
    });
  }
  return cached;
}

export function opaqueStorageKey(formId: string, uploadId: string) {
  return `forms/${formId}/uploads/${uploadId}`;
}

export function formUploadsPrefix(formId: string) {
  return `forms/${formId}/uploads/`;
}

function isAlreadyMissingDeleteError(code: string | undefined) {
  return code === "NoSuchKey" || code === "NotFound" || code === "NoSuchVersion";
}

export type StoredObjectMeta = {
  size: number;
  contentType: string | null;
};

export async function createSignedUpload(input: {
  storageKey: string;
  contentType: string;
  maxSize: number;
}) {
  const post = await createPresignedPost(s3Client(), {
    Bucket: submissionUploadsBucket,
    Key: input.storageKey,
    Expires: abuseCeilings.uploadUrlExpiresInSeconds,
    Conditions: [
      ["content-length-range", 1, input.maxSize],
      ["eq", "$Content-Type", input.contentType],
    ],
    Fields: {
      "Content-Type": input.contentType,
    },
  });

  return {
    method: "POST" as const,
    url: post.url,
    fields: post.fields,
  };
}

export async function createSignedDownload(input: { storageKey: string; filename: string }) {
  return getSignedUrl(
    s3Client(),
    new GetObjectCommand({
      Bucket: submissionUploadsBucket,
      Key: input.storageKey,
      ResponseContentDisposition: contentDispositionAttachment(input.filename),
    }),
    { expiresIn: abuseCeilings.downloadUrlExpiresInSeconds },
  );
}

export async function deleteStoredObject(storageKey: string) {
  await s3Client().send(
    new DeleteObjectCommand({
      Bucket: submissionUploadsBucket,
      Key: storageKey,
    }),
  );
}

/**
 * Bulk-delete object keys. Deduplicates, chunks to S3's 1000-key limit,
 * treats already-missing objects as success, and throws if any real delete fails.
 */
export async function deleteStoredObjects(keys: string[]) {
  const unique = [...new Set(keys.filter((key) => key.length > 0))];
  if (unique.length === 0) {
    return;
  }

  for (let offset = 0; offset < unique.length; offset += DELETE_OBJECTS_CHUNK_SIZE) {
    const chunk = unique.slice(offset, offset + DELETE_OBJECTS_CHUNK_SIZE);
    const result = await s3Client().send(
      new DeleteObjectsCommand({
        Bucket: submissionUploadsBucket,
        Delete: {
          Objects: chunk.map((Key) => ({ Key })),
          Quiet: false,
        },
      }),
    );

    const failures = (result.Errors ?? []).filter((error) => !isAlreadyMissingDeleteError(error.Code));
    if (failures.length > 0) {
      throw new Error(`Failed to delete ${failures.length} stored object(s).`);
    }
  }
}

/**
 * Delete every object under a storage prefix (e.g. forms/<formId>/uploads/).
 * Lists with pagination so prefixes with >1000 objects are fully cleaned.
 * The prefix is authoritative — does not rely on DB metadata.
 */
export async function deleteStoredPrefix(prefix: string) {
  const normalized = prefix.trim();
  if (!normalized) {
    throw new Error("Storage prefix is required.");
  }

  let continuationToken: string | undefined;
  do {
    const listed = await s3Client().send(
      new ListObjectsV2Command({
        Bucket: submissionUploadsBucket,
        Prefix: normalized,
        ContinuationToken: continuationToken,
      }),
    );

    const keys = (listed.Contents ?? [])
      .map((object) => object.Key)
      .filter((key): key is string => typeof key === "string" && key.length > 0);

    await deleteStoredObjects(keys);

    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);
}

export async function headStoredObject(storageKey: string): Promise<StoredObjectMeta | null> {
  try {
    const result = await s3Client().send(
      new HeadObjectCommand({
        Bucket: submissionUploadsBucket,
        Key: storageKey,
      }),
    );
    const size = result.ContentLength;
    if (typeof size !== "number" || !Number.isFinite(size)) {
      return null;
    }
    return {
      size,
      contentType: result.ContentType?.split(";")[0]?.trim().toLowerCase() || null,
    };
  } catch {
    return null;
  }
}

export async function storedObjectExists(storageKey: string) {
  return (await headStoredObject(storageKey)) !== null;
}

/** Read the leading bytes of an object for content sniffing. */
export async function readStoredObjectPrefix(storageKey: string, maxBytes = 512): Promise<Uint8Array | null> {
  try {
    const result = await s3Client().send(
      new GetObjectCommand({
        Bucket: submissionUploadsBucket,
        Key: storageKey,
        Range: `bytes=0-${Math.max(0, maxBytes - 1)}`,
      }),
    );
    if (!result.Body) {
      return null;
    }
    const bytes = await result.Body.transformToByteArray();
    return bytes;
  } catch {
    return null;
  }
}

export async function putStoredObject(input: { storageKey: string; body: Uint8Array; contentType: string }) {
  await s3Client().send(
    new PutObjectCommand({
      Bucket: submissionUploadsBucket,
      Key: input.storageKey,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
}
