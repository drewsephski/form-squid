import { beforeEach, describe, expect, jest, test } from "@jest/globals";

jest.mock("next/headers", () => ({ headers: jest.fn(async () => new Headers()) }));
jest.mock("@/lib/auth", () => ({ auth: { api: { getSession: jest.fn() } } }));
jest.mock("@/app/lib/auth-guards", () => ({ requireFormOwner: jest.fn() }));
jest.mock("@/db", () => ({ db: { select: jest.fn() } }));
jest.mock("drizzle-orm", () => {
  const actual = jest.requireActual<typeof import("drizzle-orm")>("drizzle-orm");
  const predicate = (op: string, args: unknown[]) => ({ __predicate: op, args });
  return {
    ...actual,
    and: (...args: unknown[]) => predicate("and", args),
    asc: (...args: unknown[]) => predicate("asc", args),
    desc: (...args: unknown[]) => predicate("desc", args),
    eq: (...args: unknown[]) => predicate("eq", args),
    lt: (...args: unknown[]) => predicate("lt", args),
    lte: (...args: unknown[]) => predicate("lte", args),
    or: (...args: unknown[]) => predicate("or", args),
  };
});

import { GET } from "@/app/api/forms/[formId]/submissions/export/route";
import { requireFormOwner } from "@/app/lib/auth-guards";
import { formVersions, submissions } from "@/db/schema";
import { db } from "@/db";
import { auth } from "@/lib/auth";

const mockedGetSession = jest.mocked(auth.api.getSession);
const mockedRequireFormOwner = jest.mocked(requireFormOwner);
const mockedSelect = db.select as jest.Mock;

function predicateValues(input: unknown): unknown[] {
  if (input === null || typeof input !== "object") return [input];
  if (input instanceof Date) return [input];
  if (!("__predicate" in input)) return [];
  const record = input as { args: unknown[] };
  return record.args.flatMap(predicateValues);
}

describe("submission CSV route authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 401 without a session", async () => {
    mockedGetSession.mockResolvedValue(null);

    const response = await GET(new Request("https://formsquid.com/api/forms/form-1/submissions/export"), {
      params: Promise.resolve({ formId: "form-1" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Not authenticated" });
    expect(mockedRequireFormOwner).not.toHaveBeenCalled();
  });

  test("returns 404 when the requested form is missing or belongs to someone else", async () => {
    mockedGetSession.mockResolvedValue({ user: { id: "user-1" } } as Awaited<ReturnType<typeof auth.api.getSession>>);
    mockedRequireFormOwner.mockRejectedValue(new Error("Form not found"));

    const response = await GET(new Request("https://formsquid.com/api/forms/form-1/submissions/export"), {
      params: Promise.resolve({ formId: "form-1" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Form not found" });
    expect(mockedRequireFormOwner).toHaveBeenCalledWith("form-1", "user-1");
  });

  test("streams an authorized export with its watermark predicate and readable headers", async () => {
    const watermark = { id: "row-1", createdAt: new Date("2026-10-01T12:00:00.000Z") };
    const spec = {
      schemaVersion: 1,
      title: "Intake",
      submitLabel: "Send",
      successMessage: "Thanks",
      steps: [{
        id: "step",
        title: "About",
        fields: [{ id: "full_name", type: "text", label: "Full name", required: true }],
      }],
    };
    const queries: Array<{ table?: unknown; wherePredicate?: unknown; limitValue?: number }> = [];
    mockedGetSession.mockResolvedValue({ user: { id: "user-1" } } as Awaited<ReturnType<typeof auth.api.getSession>>);
    mockedRequireFormOwner.mockResolvedValue({ slug: "intake" } as Awaited<ReturnType<typeof requireFormOwner>>);
    mockedSelect.mockImplementation(() => {
      type MockQuery = {
        table?: unknown;
        wherePredicate?: unknown;
        limitValue?: number;
        from: (table: unknown) => typeof query;
        where: (clause: unknown) => typeof query;
        orderBy: (...order: unknown[]) => typeof query;
        limit: (limit: number) => typeof query;
        then: (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) => Promise<unknown>;
      };
      const query = {} as MockQuery;
      Object.assign(query, {
        from(table: unknown) { query.table = table; return query; },
        where(clause: unknown) { query.wherePredicate = clause; return query; },
        orderBy() { return query; },
        limit(limit: number) { query.limitValue = limit; return query; },
        then(resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) {
          queries.push({ table: query.table, wherePredicate: query.wherePredicate, limitValue: query.limitValue });
          const result = query.table === formVersions
            ? [{ id: "version-1", versionNumber: 1, spec }]
            : query.limitValue === 1
              ? [watermark]
              : [{
                  id: watermark.id,
                  formVersionId: "version-1",
                  payload: { full_name: "Ada" },
                  createdAt: watermark.createdAt,
                }];
          return Promise.resolve(result).then(resolve, reject);
        },
      });
      return query;
    });

    const response = await GET(new Request("https://formsquid.com/api/forms/form-1/submissions/export"), {
      params: Promise.resolve({ formId: "form-1" }),
    });
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toContain('filename="intake.csv"');
    expect(csv).toBe(
      '"submitted","Full name"\r\n"2026-10-01T12:00:00.000Z","Ada"\r\n',
    );
    const pageQuery = queries.find((query) => query.table === submissions && query.limitValue === 51);
    expect(predicateValues(pageQuery?.wherePredicate)).toContain(watermark.id);
    expect(predicateValues(pageQuery?.wherePredicate)).toContain(watermark.createdAt);
  });
});
