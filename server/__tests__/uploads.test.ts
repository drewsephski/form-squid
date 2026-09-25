import { describe, expect, test } from "@jest/globals";
import { abuseCeilings } from "../../app/lib/upload-limits";
import { opaqueStorageKey } from "../storage";

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
