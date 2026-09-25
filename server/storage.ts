import { DeleteObjectCommand, HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { abuseCeilings, submissionUploadsBucket } from "../app/lib/upload-limits";
import { contentDispositionAttachment } from "../app/lib/file-field";

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

export async function storedObjectExists(storageKey: string) {
  try {
    await s3Client().send(
      new HeadObjectCommand({
        Bucket: submissionUploadsBucket,
        Key: storageKey,
      }),
    );
    return true;
  } catch {
    return false;
  }
}

// Keep PutObject available for server-side maintenance/tests if needed.
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
