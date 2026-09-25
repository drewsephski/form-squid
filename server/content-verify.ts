/** Pragmatic V1 content sniffing for the default verifiable allowlist. */

const verifiableMimeTypes = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
]);

export function isVerifiableContentType(contentType: string) {
  return verifiableMimeTypes.has(contentType.trim().toLowerCase());
}

function startsWithBytes(buffer: Uint8Array, signature: number[]) {
  if (buffer.length < signature.length) {
    return false;
  }
  return signature.every((byte, index) => buffer[index] === byte);
}

function startsWithAscii(buffer: Uint8Array, ascii: string) {
  const expected = Buffer.from(ascii, "ascii");
  if (buffer.length < expected.length) {
    return false;
  }
  return Buffer.from(buffer.subarray(0, expected.length)).equals(expected);
}

function looksLikeText(buffer: Uint8Array) {
  if (buffer.length === 0) {
    return false;
  }
  let nul = 0;
  let suspicious = 0;
  for (const byte of buffer) {
    if (byte === 0) {
      nul += 1;
    } else if (byte < 7 || (byte > 14 && byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) {
      suspicious += 1;
    }
  }
  if (nul > 0) {
    return false;
  }
  return suspicious / buffer.length < 0.05;
}

export function verifyContentMatchesType(contentType: string, prefix: Uint8Array): { ok: true } | { ok: false; reason: string } {
  const normalized = contentType.trim().toLowerCase();
  if (!isVerifiableContentType(normalized)) {
    return { ok: false, reason: "This file type cannot be verified yet." };
  }

  if (normalized === "application/pdf") {
    return startsWithAscii(prefix, "%PDF-")
      ? { ok: true }
      : { ok: false, reason: "File content does not look like a PDF." };
  }

  if (normalized === "image/png") {
    return startsWithBytes(prefix, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      ? { ok: true }
      : { ok: false, reason: "File content does not look like a PNG." };
  }

  if (normalized === "image/jpeg") {
    return startsWithBytes(prefix, [0xff, 0xd8, 0xff])
      ? { ok: true }
      : { ok: false, reason: "File content does not look like a JPEG." };
  }

  if (normalized === "image/gif") {
    return startsWithAscii(prefix, "GIF87a") || startsWithAscii(prefix, "GIF89a")
      ? { ok: true }
      : { ok: false, reason: "File content does not look like a GIF." };
  }

  if (normalized === "image/webp") {
    const riff = startsWithAscii(prefix, "RIFF");
    const webp = prefix.length >= 12 && startsWithAscii(prefix.subarray(8, 12), "WEBP");
    return riff && webp
      ? { ok: true }
      : { ok: false, reason: "File content does not look like a WEBP." };
  }

  if (normalized === "text/plain" || normalized === "text/csv") {
    try {
      new TextDecoder("utf-8", { fatal: false }).decode(prefix);
    } catch {
      return { ok: false, reason: "File content is not valid text." };
    }
    return looksLikeText(prefix)
      ? { ok: true }
      : { ok: false, reason: "File content does not look like plain text." };
  }

  return { ok: false, reason: "This file type cannot be verified yet." };
}
