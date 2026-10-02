import { describe, expect, test } from "@jest/globals";
import { csvCell } from "../csv";
import {
  csvColumns,
  csvDownloadFilename,
  csvReadableStream,
  submissionCsvChunks,
} from "../submission-csv";
import type { CsvSubmission, CsvVersion } from "../submission-csv";

const intakeV1: CsvVersion = {
  id: "v1",
  versionNumber: 1,
  spec: {
    schemaVersion: 1,
    title: "Intake",
    submitLabel: "Send",
    successMessage: "Thanks",
    steps: [{
      id: "step",
      title: "About",
      fields: [
        { id: "name", type: "text", label: "Name", required: true },
        { id: "email_one", type: "email", label: "Email", required: true },
      ],
    }],
  },
};

const intakeV2: CsvVersion = {
  ...intakeV1,
  id: "v2",
  versionNumber: 2,
  spec: {
    ...intakeV1.spec,
    steps: [{
      id: "step",
      title: "About",
      fields: [
        { id: "name", type: "text", label: "Full name", required: true },
        { id: "email_two", type: "email", label: "Email", required: true },
      ],
    }],
  },
};

describe("submission CSV export", () => {
  test.each(["=1+1", "+SUM(A1:A2)", "-2+3", "@SUM(A1)", "  =1+1", "\t=1+1", "\r=1+1"])(
    "neutralizes formula-like cells beginning with %p",
    (value) => {
      expect(csvCell(value)).toBe(`"'${value}"`);
    },
  );

  test("quotes ordinary values and doubles embedded quotes", () => {
    expect(csvCell('A "quoted" answer')).toBe('"A ""quoted"" answer"');
    expect(csvCell("hello")).toBe('"hello"');
  });

  test("keeps renamed same-ID fields together and disambiguates duplicate labels", () => {
    expect(csvColumns([intakeV1, intakeV2], [])).toEqual([
      { id: "name", label: "Name / Full name" },
      { id: "email_one", label: "Email [email_one]" },
      { id: "email_two", label: "Email [email_two]" },
    ]);
  });

  test("distinguishes a field label from the submission timestamp header", () => {
    const version = {
      id: "v1", versionNumber: 1,
      spec: { schemaVersion: 1, title: "Test", submitLabel: "Send", successMessage: "Sent",
        steps: [{ id: "main", title: "Main", fields: [{ id: "answer", type: "text", label: "submitted", required: false }] }],
      },
    };
    expect(csvColumns([version], [])).toEqual([{ id: "answer", label: "submitted [answer]" }]);
  });

  test("streams all rows across pages with a union of version and legacy keys", async () => {
    const rows: CsvSubmission[] = [
      {
        id: "row-new",
        formVersionId: "v2",
        createdAt: new Date("2026-10-01T12:00:00Z"),
        payload: { name: "=2+2", "email_two": "ada@example.com", legacy: "old" },
      },
      {
        id: "row-old",
        formVersionId: "v1",
        createdAt: new Date("2026-09-30T12:00:00Z"),
        payload: { name: "Ada", "email_one": "ada@example.com" },
      },
    ];
    const pageCalls: Array<string | null> = [];
    const loadPage = async (cursor: string | null) => {
      pageCalls.push(cursor);
      if (cursor === null) return { submissions: rows.slice(0, 1), nextCursor: "older" };
      return { submissions: rows.slice(1), nextCursor: null };
    };
    const stream = csvReadableStream((signal) => submissionCsvChunks({ versions: [intakeV1, intakeV2], loadPage, signal }));
    const csv = await new Response(stream).text();

    expect(csv).toBe(
      '"submitted","Name / Full name","Email [email_one]","Email [email_two]","Unknown field (legacy)"\r\n' +
        '"2026-10-01T12:00:00.000Z","\'=2+2","","ada@example.com","old"\r\n' +
        '"2026-09-30T12:00:00.000Z","Ada","ada@example.com","",""\r\n',
    );
    expect(pageCalls).toEqual([null, "older", null, "older"]);
  });

  test("uses one export watermark so submissions arriving during discovery are excluded", async () => {
    const watermark = { id: "row-1", createdAt: "2026-10-01T12:00:00.000Z" };
    const page = [
      {
        id: "row-2",
        formVersionId: "v2",
        createdAt: "2026-10-01T12:00:01.000Z",
        payload: { late_field: "added after export began" },
      },
      {
        id: "row-1",
        formVersionId: "v1",
        createdAt: "2026-10-01T12:00:00.000Z",
        payload: { name: "Ada" },
      },
    ];
    const csv = await new Response(csvReadableStream((signal) => submissionCsvChunks({
      versions: [intakeV1],
      watermark,
      signal,
      loadPage: async () => ({ submissions: page, nextCursor: null }),
    }))).text();

    expect(csv).toContain('"Name"');
    expect(csv).not.toContain("late_field");
    expect(csv).not.toContain("added after export began");
  });

  test("exports file names as safe CSV text and builds a safe download filename", async () => {
    expect(csvColumns([], ["files"])).toEqual([{ id: "files", label: "Unknown field (files)" }]);
    const file = {
      id: "f0000000-0000-4000-8000-000000000001",
      name: "=cmd.csv",
      size: 20,
      contentType: "text/csv",
    };
    const chunks = submissionCsvChunks({
      versions: [],
      loadPage: async () => ({
        submissions: [{ id: "file-row", formVersionId: "v1", createdAt: "2026-10-01T12:00:00.000Z", payload: { file: [file] } }],
        nextCursor: null,
      }),
    });
    const output = await new Response(csvReadableStream(() => chunks)).text();
    expect(output).toContain(`"'=cmd.csv (${file.id})"`);
    expect(csvDownloadFilename("intake form")).toBe(
      "attachment; filename=\"intake_form.csv\"; filename*=UTF-8''intake%20form.csv",
    );
  });

  test("cancelling during key discovery stops after the active page", async () => {
    let continueDiscovery!: (page: { submissions: CsvSubmission[]; nextCursor: string | null }) => void;
    let markSecondPageStarted!: () => void;
    const secondPageStarted = new Promise<void>((resolve) => { markSecondPageStarted = resolve; });
    const finishSecondPage = new Promise<{ submissions: CsvSubmission[]; nextCursor: string | null }>((resolve) => {
      continueDiscovery = resolve;
    });
    const pageCalls: Array<string | null> = [];
    const stream = csvReadableStream((signal) => submissionCsvChunks({
      versions: [intakeV1],
      signal,
      loadPage: async (cursor) => {
        pageCalls.push(cursor);
        if (cursor === null) {
          return {
            submissions: [{
              id: "row-1",
              formVersionId: "v1",
              createdAt: "2026-10-01T12:00:00.000Z",
              payload: { name: "Ada" },
            }],
            nextCursor: "older",
          };
        }
        markSecondPageStarted();
        return finishSecondPage;
      },
    }));
    const reader = stream.getReader();
    const firstRead = reader.read();
    await secondPageStarted;
    const cancel = reader.cancel();
    continueDiscovery({ submissions: [], nextCursor: null });
    await cancel;
    await firstRead;

    expect(pageCalls).toEqual([null, "older"]);
  });
});
