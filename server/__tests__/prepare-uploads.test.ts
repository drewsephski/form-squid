import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import type { FormSpec } from "../../app/lib/definitions";
import { prepareUploadsForSubmission } from "../uploads";

const headStoredObject = jest.fn();
const readStoredObjectPrefix = jest.fn();
const deleteStoredObject = jest.fn();

jest.mock("../storage", () => ({
  headStoredObject: (...args: unknown[]) => headStoredObject(...args),
  readStoredObjectPrefix: (...args: unknown[]) => readStoredObjectPrefix(...args),
  deleteStoredObject: (...args: unknown[]) => deleteStoredObject(...args),
  createSignedUpload: jest.fn(),
  createSignedDownload: jest.fn(),
  opaqueStorageKey: (formId: string, uploadId: string) => `forms/${formId}/uploads/${uploadId}`,
  storedObjectExists: jest.fn(),
  putStoredObject: jest.fn(),
}));

const uploadId = "11111111-1111-4111-8111-111111111111";
const pdfPrefix = Buffer.from("%PDF-1.4 sample");

const spec: FormSpec = {
  schemaVersion: 1,
  title: "Apply",
  submitLabel: "Send",
  successMessage: "Sent",
  steps: [
    {
      id: "main",
      title: "Main",
      fields: [
        {
          id: "resume",
          type: "file",
          label: "Resume",
          required: true,
          maxFiles: 1,
          maxFileSizeMb: 10,
          accept: ["application/pdf"],
        },
      ],
    },
  ],
};

function databaseWithRow(row: {
  id: string;
  formId: string;
  submissionId: string | null;
  fieldId: string;
  storageKey: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  actorHash: string;
}) {
  return {
    select() {
      return {
        from() {
          return {
            where: async (condition: unknown) => {
              // First select is submission_files rows; second may be quota sum.
              if (condition && typeof condition === "object") {
                return [row];
              }
              return [row];
            },
          };
        },
      };
    },
  } as never;
}

describe("prepareUploadsForSubmission object verification", () => {
  beforeEach(() => {
    headStoredObject.mockReset();
    readStoredObjectPrefix.mockReset();
    deleteStoredObject.mockReset();
    deleteStoredObject.mockResolvedValue(undefined);
  });

  test("rejects declared 1KB when stored object is 5MB", async () => {
    headStoredObject.mockResolvedValue({ size: 5 * 1024 * 1024, contentType: "application/pdf" });
    const database = databaseWithRow({
      id: uploadId,
      formId: "form-1",
      submissionId: null,
      fieldId: "resume",
      storageKey: "forms/form-1/uploads/" + uploadId,
      originalFilename: "resume.pdf",
      contentType: "application/pdf",
      sizeBytes: 1024,
      actorHash: "actor",
    });

    const result = await prepareUploadsForSubmission(database, {
      formId: "form-1",
      actorHash: "actor",
      spec,
      data: { resume: uploadId },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.message).toMatch(/size/i);
    }
    expect(deleteStoredObject).toHaveBeenCalled();
  });

  test("rejects stored object that exceeds field limit", async () => {
    headStoredObject.mockResolvedValue({ size: 11 * 1024 * 1024, contentType: "application/pdf" });
    const database = databaseWithRow({
      id: uploadId,
      formId: "form-1",
      submissionId: null,
      fieldId: "resume",
      storageKey: "key",
      originalFilename: "resume.pdf",
      contentType: "application/pdf",
      sizeBytes: 11 * 1024 * 1024,
      actorHash: "actor",
    });

    const result = await prepareUploadsForSubmission(database, {
      formId: "form-1",
      actorHash: "actor",
      spec,
      data: { resume: uploadId },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.message).toMatch(/MB or smaller/i);
    }
  });

  test("rejects content type mismatch", async () => {
    headStoredObject.mockResolvedValue({ size: 1024, contentType: "image/png" });
    const database = databaseWithRow({
      id: uploadId,
      formId: "form-1",
      submissionId: null,
      fieldId: "resume",
      storageKey: "key",
      originalFilename: "resume.pdf",
      contentType: "application/pdf",
      sizeBytes: 1024,
      actorHash: "actor",
    });

    const result = await prepareUploadsForSubmission(database, {
      formId: "form-1",
      actorHash: "actor",
      spec,
      data: { resume: uploadId },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.message).toMatch(/type/i);
    }
  });

  test("rejects missing object", async () => {
    headStoredObject.mockResolvedValue(null);
    const database = databaseWithRow({
      id: uploadId,
      formId: "form-1",
      submissionId: null,
      fieldId: "resume",
      storageKey: "key",
      originalFilename: "resume.pdf",
      contentType: "application/pdf",
      sizeBytes: 1024,
      actorHash: "actor",
    });

    const result = await prepareUploadsForSubmission(database, {
      formId: "form-1",
      actorHash: "actor",
      spec,
      data: { resume: uploadId },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]?.message).toMatch(/incomplete/i);
    }
  });

  test("uses verified size in SubmissionFileRef", async () => {
    headStoredObject.mockResolvedValue({ size: 2048, contentType: "application/pdf" });
    readStoredObjectPrefix.mockResolvedValue(pdfPrefix);
    let call = 0;
    const database = {
      select() {
        return {
          from() {
            return {
              where: async () => {
                call += 1;
                if (call === 1) {
                  return [
                    {
                      id: uploadId,
                      formId: "form-1",
                      submissionId: null,
                      fieldId: "resume",
                      storageKey: "key",
                      originalFilename: "resume.pdf",
                      contentType: "application/pdf",
                      sizeBytes: 2048,
                      actorHash: "actor",
                    },
                  ];
                }
                return [{ total: 0 }];
              },
            };
          },
        };
      },
    } as never;

    const result = await prepareUploadsForSubmission(database, {
      formId: "form-1",
      actorHash: "actor",
      spec,
      data: { resume: uploadId },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.resume).toEqual({
        id: uploadId,
        name: "resume.pdf",
        contentType: "application/pdf",
        size: 2048,
      });
      expect(result.claims[0]?.verifiedSize).toBe(2048);
    }
  });
});
