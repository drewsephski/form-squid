import { describe, expect, test } from "@jest/globals";
import { isVerifiableContentType, verifyContentMatchesType } from "../content-verify";
import { defaultAcceptMimeTypes } from "../../app/lib/upload-limits";

describe("content verification", () => {
  test("default allowlist only includes verifiable types", () => {
    for (const mime of defaultAcceptMimeTypes) {
      expect(isVerifiableContentType(mime)).toBe(true);
    }
    expect(isVerifiableContentType("application/msword")).toBe(false);
    expect(
      isVerifiableContentType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    ).toBe(false);
  });

  test("recognizes PDF PNG JPEG GIF WEBP signatures", () => {
    expect(verifyContentMatchesType("application/pdf", Buffer.from("%PDF-1.4")).ok).toBe(true);
    expect(
      verifyContentMatchesType(
        "image/png",
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
      ).ok,
    ).toBe(true);
    expect(verifyContentMatchesType("image/jpeg", Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])).ok).toBe(true);
    expect(verifyContentMatchesType("image/gif", Buffer.from("GIF89a......")).ok).toBe(true);
    const webp = Buffer.alloc(12);
    webp.write("RIFF", 0);
    webp.write("WEBP", 8);
    expect(verifyContentMatchesType("image/webp", webp).ok).toBe(true);
  });

  test("rejects mismatched binary signatures", () => {
    expect(verifyContentMatchesType("application/pdf", Buffer.from("not a pdf")).ok).toBe(false);
    expect(verifyContentMatchesType("image/png", Buffer.from("%PDF-1.4")).ok).toBe(false);
  });

  test("rejects NUL-heavy text", () => {
    expect(verifyContentMatchesType("text/plain", Buffer.from("hello\0world")).ok).toBe(false);
    expect(verifyContentMatchesType("text/csv", Buffer.from("a,b,c\n1,2,3\n")).ok).toBe(true);
  });
});
