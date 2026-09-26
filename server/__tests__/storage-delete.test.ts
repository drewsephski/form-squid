import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const send = jest.fn<(...args: unknown[]) => Promise<unknown>>();

jest.mock("@aws-sdk/client-s3", () => {
  class FakeCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send })),
    DeleteObjectCommand: FakeCommand,
    DeleteObjectsCommand: FakeCommand,
    ListObjectsV2Command: FakeCommand,
    GetObjectCommand: FakeCommand,
    HeadObjectCommand: FakeCommand,
    PutObjectCommand: FakeCommand,
  };
});

import {
  deleteStoredObjects,
  deleteStoredPrefix,
  formUploadsPrefix,
} from "../storage";

describe("deleteStoredObjects", () => {
  beforeEach(() => {
    send.mockReset();
    send.mockResolvedValue({ Errors: [] });
  });

  test("no-ops on empty list", async () => {
    await deleteStoredObjects([]);
    expect(send).not.toHaveBeenCalled();
  });

  test("deduplicates keys before deleting", async () => {
    await deleteStoredObjects(["a", "b", "a", ""]);
    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0]?.[0] as { input: { Delete: { Objects: { Key: string }[] } } };
    expect(command.input.Delete.Objects).toEqual([{ Key: "a" }, { Key: "b" }]);
  });

  test("chunks requests above 1000 keys", async () => {
    const keys = Array.from({ length: 1001 }, (_, index) => `key-${index}`);
    await deleteStoredObjects(keys);
    expect(send).toHaveBeenCalledTimes(2);
    const first = send.mock.calls[0]?.[0] as { input: { Delete: { Objects: unknown[] } } };
    const second = send.mock.calls[1]?.[0] as { input: { Delete: { Objects: unknown[] } } };
    expect(first.input.Delete.Objects).toHaveLength(1000);
    expect(second.input.Delete.Objects).toHaveLength(1);
  });

  test("treats already-missing object errors as success", async () => {
    send.mockResolvedValue({
      Errors: [
        { Key: "gone", Code: "NoSuchKey", Message: "missing" },
        { Key: "also", Code: "NotFound", Message: "missing" },
      ],
    });
    await expect(deleteStoredObjects(["gone", "also"])).resolves.toBeUndefined();
  });

  test("throws when a real deletion fails", async () => {
    send.mockResolvedValue({
      Errors: [{ Key: "locked", Code: "AccessDenied", Message: "denied" }],
    });
    await expect(deleteStoredObjects(["locked"])).rejects.toThrow(/Failed to delete 1 stored object/);
  });
});

describe("deleteStoredPrefix", () => {
  beforeEach(() => {
    send.mockReset();
  });

  test("lists and deletes across pages", async () => {
    send
      .mockResolvedValueOnce({
        Contents: [{ Key: "forms/f/uploads/1" }, { Key: "forms/f/uploads/2" }],
        IsTruncated: true,
        NextContinuationToken: "page-2",
      })
      .mockResolvedValueOnce({ Errors: [] })
      .mockResolvedValueOnce({
        Contents: [{ Key: "forms/f/uploads/3" }],
        IsTruncated: false,
      })
      .mockResolvedValueOnce({ Errors: [] });

    await deleteStoredPrefix(formUploadsPrefix("f"));

    expect(send).toHaveBeenCalledTimes(4);
    const list1 = send.mock.calls[0]?.[0] as { input: { Prefix: string; ContinuationToken?: string } };
    const delete1 = send.mock.calls[1]?.[0] as { input: { Delete: { Objects: { Key: string }[] } } };
    const list2 = send.mock.calls[2]?.[0] as { input: { Prefix: string; ContinuationToken?: string } };
    const delete2 = send.mock.calls[3]?.[0] as { input: { Delete: { Objects: { Key: string }[] } } };

    expect(list1.input.Prefix).toBe("forms/f/uploads/");
    expect(list1.input.ContinuationToken).toBeUndefined();
    expect(delete1.input.Delete.Objects.map((object) => object.Key)).toEqual([
      "forms/f/uploads/1",
      "forms/f/uploads/2",
    ]);
    expect(list2.input.ContinuationToken).toBe("page-2");
    expect(delete2.input.Delete.Objects.map((object) => object.Key)).toEqual(["forms/f/uploads/3"]);
  });

  test("no-ops when prefix has no objects", async () => {
    send.mockResolvedValueOnce({ Contents: [], IsTruncated: false });
    await deleteStoredPrefix("forms/empty/uploads/");
    expect(send).toHaveBeenCalledTimes(1);
  });

  test("rejects empty prefix", async () => {
    await expect(deleteStoredPrefix("   ")).rejects.toThrow(/prefix is required/i);
    expect(send).not.toHaveBeenCalled();
  });
});
