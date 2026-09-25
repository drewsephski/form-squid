import { describe, expect, test } from "@jest/globals";
import { claimUploadsForSubmission } from "../uploads";

describe("claimUploadsForSubmission", () => {
  test("throws when fewer rows are claimed than expected (concurrency / already claimed)", async () => {
    const database = {
      update() {
        return {
          set() {
            return {
              where() {
                return {
                  returning: async () => [{ id: "11111111-1111-4111-8111-111111111111" }],
                  // size update path has no returning
                };
              },
            };
          },
        };
      },
    } as never;

    // First update is sizeBytes (no returning used); second is claim returning.
    let updateCount = 0;
    const trackingDb = {
      update() {
        updateCount += 1;
        return {
          set() {
            return {
              where() {
                if (updateCount <= 2) {
                  // two size updates for two claims
                  return Promise.resolve();
                }
                return {
                  returning: async () => [{ id: "11111111-1111-4111-8111-111111111111" }],
                };
              },
            };
          },
        };
      },
    } as never;

    await expect(
      claimUploadsForSubmission(trackingDb, {
        formId: "form",
        submissionId: "sub",
        actorHash: "actor",
        claims: [
          {
            uploadId: "11111111-1111-4111-8111-111111111111",
            fieldId: "resume",
            verifiedSize: 10,
            contentType: "application/pdf",
            name: "a.pdf",
          },
          {
            uploadId: "22222222-2222-4222-8222-222222222222",
            fieldId: "resume",
            verifiedSize: 10,
            contentType: "application/pdf",
            name: "b.pdf",
          },
        ],
      }),
    ).rejects.toMatchObject({
      errors: [{ message: "Upload is not available for this form." }],
    });

    void database;
  });
});
