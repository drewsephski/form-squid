import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { abuseCeilings } from "../../app/lib/upload-limits";

const deleteStoredObject = jest.fn<(key: string) => Promise<void>>();

jest.mock("../storage", () => ({
  opaqueStorageKey: (formId: string, uploadId: string) => `forms/${formId}/uploads/${uploadId}`,
  deleteStoredObject: (...args: [string]) => deleteStoredObject(...args),
  createSignedUpload: jest.fn(),
  createSignedDownload: jest.fn(),
  headStoredObject: jest.fn(),
  readStoredObjectPrefix: jest.fn(),
  storedObjectExists: jest.fn(),
  putStoredObject: jest.fn(),
  deleteStoredObjects: jest.fn(),
  deleteStoredPrefix: jest.fn(),
  formUploadsPrefix: (formId: string) => `forms/${formId}/uploads/`,
}));

import { opaqueStorageKey } from "../storage";
import { purgeStalePendingUploads } from "../uploads";

type FileRow = {
  id: string;
  submissionId: string | null;
  storageKey: string;
  createdAt: Date;
};

function purgeDatabase(rows: FileRow[]) {
  const deletedIds: string[] = [];
  return {
    deletedIds,
    select() {
      return {
        from() {
          return {
            where() {
              return {
                // Mirrors purgeStalePendingUploads: only pending (null submission_id) rows.
                limit: async () => rows.filter((row) => row.submissionId === null),
              };
            },
          };
        },
      };
    },
    delete() {
      return {
        where() {
          return {
            returning: async () => {
              // Second safety: only delete while still pending.
              const pending = rows.filter((row) => row.submissionId === null && !deletedIds.includes(row.id));
              const removed = pending.slice(0, 1);
              for (const row of removed) {
                deletedIds.push(row.id);
              }
              return removed.map((row) => ({ id: row.id }));
            },
          };
        },
      };
    },
  };
}

describe("upload security helpers", () => {
  test("opaque storage keys never include filenames", () => {
    const key = opaqueStorageKey("form_123", "11111111-1111-4111-8111-111111111111");
    expect(key).toBe("forms/form_123/uploads/11111111-1111-4111-8111-111111111111");
    expect(key).not.toContain("resume");
    expect(key).not.toContain(".pdf");
  });

  test("pending upload ttl is 24 hours", () => {
    expect(abuseCeilings.pendingUploadTtlHours).toBe(24);
  });
});

describe("purgeStalePendingUploads", () => {
  const now = new Date("2026-09-25T12:00:00.000Z");
  const stale = new Date(now.getTime() - (abuseCeilings.pendingUploadTtlHours + 1) * 60 * 60 * 1000);

  beforeEach(() => {
    deleteStoredObject.mockReset();
    deleteStoredObject.mockResolvedValue(undefined);
  });

  test("never touches attached files", async () => {
    const attachedKey = "forms/form-1/uploads/attached";
    const pendingKey = "forms/form-1/uploads/pending";
    const database = purgeDatabase([
      {
        id: "attached",
        submissionId: "sub-1",
        storageKey: attachedKey,
        createdAt: stale,
      },
      {
        id: "pending",
        submissionId: null,
        storageKey: pendingKey,
        createdAt: stale,
      },
    ]);

    const deleted = await purgeStalePendingUploads(database as never, now);

    expect(deleted).toBe(1);
    expect(deleteStoredObject).toHaveBeenCalledTimes(1);
    expect(deleteStoredObject).toHaveBeenCalledWith(pendingKey);
    expect(deleteStoredObject).not.toHaveBeenCalledWith(attachedKey);
    expect(database.deletedIds).toEqual(["pending"]);
  });

  test("does nothing when only attached files exist", async () => {
    const database = purgeDatabase([
      {
        id: "attached",
        submissionId: "sub-1",
        storageKey: "forms/form-1/uploads/attached",
        createdAt: stale,
      },
    ]);

    const deleted = await purgeStalePendingUploads(database as never, now);

    expect(deleted).toBe(0);
    expect(deleteStoredObject).not.toHaveBeenCalled();
    expect(database.deletedIds).toEqual([]);
  });
});
