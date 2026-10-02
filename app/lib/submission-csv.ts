import { formSpecSchema } from "./definitions";
import { csvRow } from "./csv";
import { csvFileCell } from "./submission-display";
import { isSubmissionFileRef } from "./file-field";

export type CsvVersion = {
  id: string;
  versionNumber: number;
  spec: unknown;
};

export type CsvSubmission = {
  id: string;
  formVersionId: string;
  payload: unknown;
  createdAt: Date | string;
};

export type CsvWatermark = {
  id: string;
  createdAt: Date | string;
};

export type CsvPage<T> = {
  submissions: T[];
  nextCursor: string | null;
};

export type CsvColumn = {
  id: string;
  label: string;
};

type ExportOptions<T extends CsvSubmission> = {
  versions: CsvVersion[];
  watermark?: CsvWatermark | null;
  signal?: AbortSignal;
  loadPage: (cursor: string | null) => Promise<CsvPage<T>>;
};

function timestamp(value: Date | string) {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function withinWatermark(row: CsvSubmission, watermark?: CsvWatermark | null) {
  if (!watermark) return true;
  const rowTime = timestamp(row.createdAt);
  const watermarkTime = timestamp(watermark.createdAt);
  return rowTime < watermarkTime || (rowTime === watermarkTime && row.id <= watermark.id);
}

function payloadRecord(payload: unknown): Record<string, unknown> {
  return typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
}

export function csvColumns(versions: CsvVersion[], payloadKeys: Iterable<string>): CsvColumn[] {
  const labelsById = new Map<string, string[]>();
  const orderedVersions = [...versions].sort((a, b) => a.versionNumber - b.versionNumber);

  for (const version of orderedVersions) {
    const parsed = formSpecSchema.safeParse(version.spec);
    if (!parsed.success) continue;
    for (const field of parsed.data.steps.flatMap((step) => step.fields)) {
      const labels = labelsById.get(field.id) ?? [];
      if (!labels.includes(field.label)) labels.push(field.label);
      labelsById.set(field.id, labels);
    }
  }

  for (const id of payloadKeys) {
    if (!labelsById.has(id)) labelsById.set(id, []);
  }

  const columns = [...labelsById].map(([id, labels]) => ({
    id,
    label: labels.length > 0 ? labels.join(" / ") : `Unknown field (${id})`,
  }));
  const labelCounts = new Map<string, number>([["submitted", 1]]);
  for (const column of columns) {
    labelCounts.set(column.label, (labelCounts.get(column.label) ?? 0) + 1);
  }
  return columns.map((column) => ({
    ...column,
    label: (labelCounts.get(column.label) ?? 0) > 1 ? `${column.label} [${column.id}]` : column.label,
  }));
}

function cellValue(value: unknown) {
  if (isSubmissionFileRef(value) || (Array.isArray(value) && value.some(isSubmissionFileRef))) {
    return csvFileCell(value);
  }
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

export async function* submissionCsvChunks<T extends CsvSubmission>({
  versions,
  watermark,
  signal,
  loadPage,
}: ExportOptions<T>): AsyncGenerator<string> {
  // Discover malformed or legacy payload keys without retaining submission rows.
  const keys = new Set<string>();
  let cursor: string | null = null;
  do {
    if (signal?.aborted) return;
    const page = await loadPage(cursor);
    if (signal?.aborted) return;
    for (const row of page.submissions) {
      if (signal?.aborted) return;
      if (!withinWatermark(row, watermark)) continue;
      for (const key of Object.keys(payloadRecord(row.payload))) keys.add(key);
    }
    cursor = page.nextCursor;
  } while (cursor);

  const columns = csvColumns(versions, keys);
  yield csvRow(["submitted", ...columns.map((column) => column.label)]);

  cursor = null;
  do {
    if (signal?.aborted) return;
    const page = await loadPage(cursor);
    if (signal?.aborted) return;
    for (const row of page.submissions) {
      if (signal?.aborted) return;
      if (!withinWatermark(row, watermark)) continue;
      const payload = payloadRecord(row.payload);
      const createdAt = row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt;
      yield csvRow([createdAt, ...columns.map((column) => cellValue(payload[column.id]))]);
    }
    cursor = page.nextCursor;
  } while (cursor);
}

export function csvDownloadFilename(slug: string) {
  const filename = `${slug || "form"}.csv`;
  const fallback = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const encoded = encodeURIComponent(filename).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export function csvReadableStream(createChunks: (signal: AbortSignal) => AsyncGenerator<string>) {
  const encoder = new TextEncoder();
  const abortController = new AbortController();
  const chunks = createChunks(abortController.signal);
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await chunks.next();
        if (next.done) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(next.value));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      abortController.abort();
      await chunks.return(undefined);
    },
  });
}
