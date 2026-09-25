import { describe, expect, test } from "@jest/globals";
import { deliverSubmissionWebhook, webhookRetryDelaysMs, type WebhookDatabase } from "../deliver";
import type { SubmissionDispatch } from "../payload";

type Row = Record<string, unknown>;

function createMemoryDb(webhook: Row | null) {
  const webhooks = webhook ? [webhook] : [];
  const deliveries: Row[] = [];

  const database = {
    select() {
      return {
        from() {
          return {
            where: async () => webhooks,
          };
        },
      };
    },
    insert() {
      return {
        async values(values: Row) {
          deliveries.push({ ...values });
        },
      };
    },
    update() {
      return {
        set(values: Row) {
          return {
            async where() {
              const current = deliveries[0];
              if (current) Object.assign(current, values);
            },
          };
        },
      };
    },
  };

  return { database: database as unknown as WebhookDatabase, deliveries };
}

const dispatch: SubmissionDispatch = {
  submissionId: "sub-1",
  formId: "form-1",
  formSlug: "contact",
  formTitle: "Contact",
  version: 3,
  createdAt: "2026-09-25T12:00:00.000Z",
  data: { name: "Ada" },
};

const resolvePublic = async () => ["93.184.216.34"];

describe("webhook delivery retries", () => {
  test("treats HTTP 2xx as success on the first attempt", async () => {
    const { database, deliveries } = createMemoryDb({
      id: "wh-1",
      formId: "form-1",
      url: "https://hooks.example.com/forms",
      secret: "fs_whsec_test",
      enabled: true,
    });
    const sleeps: number[] = [];
    const result = await deliverSubmissionWebhook(database, dispatch, {
      policy: { allowLoopback: false },
      resolve: resolvePublic,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      now: () => new Date("2026-09-25T12:00:00.000Z"),
      fetchImpl: (async () => new Response(null, { status: 204 })) as typeof fetch,
    });

    expect(result?.ok).toBe(true);
    expect(result?.status).toBe("delivered");
    expect(result?.responseStatus).toBe(204);
    expect(deliveries[0]?.status).toBe("delivered");
    expect(sleeps).toEqual([]);
  });

  test("retries non-2xx responses then marks failed", async () => {
    const { database, deliveries } = createMemoryDb({
      id: "wh-1",
      formId: "form-1",
      url: "https://hooks.example.com/forms",
      secret: "fs_whsec_test",
      enabled: true,
    });
    const sleeps: number[] = [];
    let calls = 0;
    const result = await deliverSubmissionWebhook(database, dispatch, {
      policy: { allowLoopback: false },
      resolve: resolvePublic,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      now: () => new Date("2026-09-25T12:00:00.000Z"),
      fetchImpl: (async () => {
        calls += 1;
        return new Response(null, { status: 500 });
      }) as typeof fetch,
    });

    expect(calls).toBe(3);
    expect(sleeps).toEqual([webhookRetryDelaysMs[1], webhookRetryDelaysMs[2]]);
    expect(result?.ok).toBe(false);
    expect(result?.status).toBe("failed");
    expect(result?.responseStatus).toBe(500);
    expect(deliveries[0]?.status).toBe("failed");
    expect(deliveries[0]?.attempt).toBe(3);
  });

  test("retries timeouts then marks failed", async () => {
    const { database, deliveries } = createMemoryDb({
      id: "wh-1",
      formId: "form-1",
      url: "https://hooks.example.com/forms",
      secret: "fs_whsec_test",
      enabled: true,
    });
    const result = await deliverSubmissionWebhook(database, dispatch, {
      policy: { allowLoopback: false },
      resolve: resolvePublic,
      sleep: async () => undefined,
      now: () => new Date("2026-09-25T12:00:00.000Z"),
      fetchImpl: (async () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      }) as typeof fetch,
    });

    expect(result?.ok).toBe(false);
    expect(result?.status).toBe("failed");
    expect(result?.error).toBe("Request timed out.");
    expect(deliveries[0]?.status).toBe("failed");
  });

  test("skips delivery when no enabled webhook exists", async () => {
    const { database, deliveries } = createMemoryDb(null);
    const result = await deliverSubmissionWebhook(database, dispatch, {
      fetchImpl: (async () => {
        throw new Error("should not fetch");
      }) as typeof fetch,
    });
    expect(result).toBeNull();
    expect(deliveries).toHaveLength(0);
  });
});
