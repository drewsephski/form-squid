import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const deleteStoredObjects = jest.fn<(keys: string[]) => Promise<void>>();
const deleteStoredPrefix = jest.fn<(prefix: string) => Promise<void>>();

jest.mock("../storage", () => ({
  deleteStoredObjects: (...args: [string[]]) => deleteStoredObjects(...args),
  deleteStoredPrefix: (...args: [string]) => deleteStoredPrefix(...args),
  formUploadsPrefix: (formId: string) => `forms/${formId}/uploads/`,
}));

import { deleteFormWithStorage, deleteSubmissionWithStorage } from "../delete-lifecycle";

type FileRow = { storageKey: string };

function submissionDatabase(options: {
  files?: FileRow[];
  onDeleteSubmission?: () => void;
}) {
  const files = options.files ?? [];
  let submissionDeleted = false;
  return {
    select() {
      return {
        from() {
          return {
            where: async () => files,
          };
        },
      };
    },
    delete() {
      return {
        where: async () => {
          submissionDeleted = true;
          options.onDeleteSubmission?.();
        },
      };
    },
    wasSubmissionDeleted: () => submissionDeleted,
  };
}

function formDatabase(options: { onDeleteForm?: () => void }) {
  let formDeleted = false;
  return {
    delete() {
      return {
        where: async () => {
          formDeleted = true;
          options.onDeleteForm?.();
        },
      };
    },
    wasFormDeleted: () => formDeleted,
  };
}

describe("deleteSubmissionWithStorage", () => {
  beforeEach(() => {
    deleteStoredObjects.mockReset();
    deleteStoredPrefix.mockReset();
    deleteStoredObjects.mockResolvedValue(undefined);
  });

  test("submission with no files deletes the DB row", async () => {
    const database = submissionDatabase({ files: [] });
    await deleteSubmissionWithStorage(database as never, { formId: "form-1", submissionId: "sub-1" });
    expect(deleteStoredObjects).toHaveBeenCalledWith([]);
    expect(database.wasSubmissionDeleted()).toBe(true);
  });

  test("submission with files deletes objects then the DB row", async () => {
    const order: string[] = [];
    deleteStoredObjects.mockImplementation(async () => {
      order.push("storage");
    });
    const database = submissionDatabase({
      files: [{ storageKey: "forms/form-1/uploads/a" }, { storageKey: "forms/form-1/uploads/b" }],
      onDeleteSubmission: () => order.push("db"),
    });

    await deleteSubmissionWithStorage(database as never, { formId: "form-1", submissionId: "sub-1" });

    expect(deleteStoredObjects).toHaveBeenCalledWith([
      "forms/form-1/uploads/a",
      "forms/form-1/uploads/b",
    ]);
    expect(order).toEqual(["storage", "db"]);
    expect(database.wasSubmissionDeleted()).toBe(true);
  });

  test("storage failure preserves the DB row", async () => {
    deleteStoredObjects.mockRejectedValue(new Error("S3 down"));
    const database = submissionDatabase({
      files: [{ storageKey: "forms/form-1/uploads/a" }],
    });

    await expect(
      deleteSubmissionWithStorage(database as never, { formId: "form-1", submissionId: "sub-1" }),
    ).rejects.toThrow(/Could not delete submission files from storage/);
    expect(database.wasSubmissionDeleted()).toBe(false);
  });

  test("missing objects do not make deletion fail", async () => {
    // deleteStoredObjects treats NoSuchKey as success; lifecycle just awaits it.
    deleteStoredObjects.mockResolvedValue(undefined);
    const database = submissionDatabase({
      files: [{ storageKey: "forms/form-1/uploads/already-gone" }],
    });

    await deleteSubmissionWithStorage(database as never, { formId: "form-1", submissionId: "sub-1" });
    expect(database.wasSubmissionDeleted()).toBe(true);
  });
});

describe("deleteFormWithStorage", () => {
  beforeEach(() => {
    deleteStoredObjects.mockReset();
    deleteStoredPrefix.mockReset();
    deleteStoredPrefix.mockResolvedValue(undefined);
  });

  test("form with no objects deletes the DB row", async () => {
    const database = formDatabase({});
    await deleteFormWithStorage(database as never, "form-1");
    expect(deleteStoredPrefix).toHaveBeenCalledWith("forms/form-1/uploads/");
    expect(database.wasFormDeleted()).toBe(true);
  });

  test("form with upload objects deletes prefix then the DB row", async () => {
    const order: string[] = [];
    deleteStoredPrefix.mockImplementation(async () => {
      order.push("storage");
    });
    const database = formDatabase({
      onDeleteForm: () => order.push("db"),
    });

    await deleteFormWithStorage(database as never, "form-1");

    expect(deleteStoredPrefix).toHaveBeenCalledWith("forms/form-1/uploads/");
    expect(order).toEqual(["storage", "db"]);
  });

  test("storage failure prevents DB delete", async () => {
    deleteStoredPrefix.mockRejectedValue(new Error("list failed"));
    const database = formDatabase({});

    await expect(deleteFormWithStorage(database as never, "form-1")).rejects.toThrow(
      /Could not delete form files from storage/,
    );
    expect(database.wasFormDeleted()).toBe(false);
  });
});
