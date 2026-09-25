import { describe, expect, test } from "@jest/globals";
import { honeypotField } from "../../app/lib/definitions";
import { submitForm, type SubmitDatabase } from "../submit-form";

function chainSelect(rowsByCall: unknown[][]) {
  let call = 0;
  return {
    select() {
      return {
        from() {
          return {
            where: async () => rowsByCall[call++] ?? [],
          };
        },
      };
    },
  };
}

describe("submitForm webhook dispatch metadata", () => {
  test("honeypot acceptance does not produce dispatch metadata", async () => {
    const database = {
      ...chainSelect([
        [{ id: "form-1", slug: "contact", currentPublishedVersionId: "version-1", notifyEmail: null }],
      ]),
      insert() {
        return {
          values() {
            return {
              onConflictDoUpdate() {
                return {
                  returning: async () => [{ attempts: 1 }],
                };
              },
            };
          },
        };
      },
    } as unknown as SubmitDatabase;

    const result = await submitForm(database, {
      slug: "contact",
      rawBody: JSON.stringify({ [honeypotField]: "bot" }),
      actorHash: "actor",
    });

    expect(result.status).toBe(200);
    expect(result.reason).toBe("honeypot");
    expect(result.dispatch).toBeUndefined();
  });

  test("invalid submissions do not produce dispatch metadata", async () => {
    const database = {
      select() {
        return {
          from() {
            return {
              where: async () => [{ id: "form-1", slug: "contact", currentPublishedVersionId: "version-1", notifyEmail: null }],
            };
          },
        };
      },
      insert() {
        return {
          values() {
            return {
              onConflictDoUpdate() {
                return {
                  returning: async () => [{ attempts: 1 }],
                };
              },
            };
          },
        };
      },
    } as unknown as SubmitDatabase;

    const result = await submitForm(database, {
      slug: "contact",
      rawBody: "null",
      actorHash: "actor",
    });

    expect(result.status).toBe(400);
    expect(result.dispatch).toBeUndefined();
  });

  test("stored valid submissions produce dispatch metadata", async () => {
    const spec = {
      schemaVersion: 1,
      title: "Contact",
      submitLabel: "Send",
      successMessage: "Thanks",
      steps: [
        {
          id: "step_1",
          title: "Details",
          fields: [{ id: "name", type: "text", label: "Name", required: true }],
        },
      ],
    };

    let stage = 0;
    const inserts: unknown[] = [];
    const database = {
      select() {
        return {
          from() {
            return {
              where: async () => {
                stage += 1;
                if (stage === 1) {
                  return [
                    {
                      id: "form-1",
                      slug: "contact",
                      currentPublishedVersionId: "version-1",
                      notifyEmail: null,
                    },
                  ];
                }
                if (stage === 2) {
                  return [{ id: "version-1", formId: "form-1", versionNumber: 3, spec }];
                }
                if (stage === 3) {
                  return [{ count: 0 }];
                }
                return [];
              },
            };
          },
        };
      },
      insert(table: { [Symbol.toStringTag]?: string }) {
        return {
          values(values: unknown) {
            inserts.push({ table, values });
            return {
              onConflictDoUpdate() {
                return {
                  returning: async () => [{ attempts: 1 }],
                };
              },
            };
          },
        };
      },
    } as unknown as SubmitDatabase;

    const result = await submitForm(database, {
      slug: "contact",
      rawBody: JSON.stringify({ name: "Ada" }),
      actorHash: "actor",
      now: new Date("2026-09-25T12:00:00.000Z"),
    });

    expect(result.status).toBe(200);
    expect(result.reason).toBe("stored");
    expect(result.dispatch).toMatchObject({
      formId: "form-1",
      formSlug: "contact",
      formTitle: "Contact",
      version: 3,
      createdAt: "2026-09-25T12:00:00.000Z",
      data: { name: "Ada" },
    });
    expect(result.dispatch?.submissionId).toEqual(expect.any(String));
    expect(inserts.some((entry) => entry && typeof entry === "object" && "values" in (entry as object))).toBe(true);
  });
});
