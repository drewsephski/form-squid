import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { FormSpec, SubmissionData } from "../../app/lib/definitions";
import { formSpecSchema } from "../../app/lib/definitions";
import * as schema from "../../db/schema";
import { formVersions, formWebhooks, forms, submissions, webhookDeliveries } from "../../db/schema";
import {
  buildWebhookPayload,
  sampleSubmissionData,
  submissionCreatedEvent,
  submissionTestEvent,
  type SubmissionDispatch,
  type WebhookPayload,
} from "./payload";
import { webhookSignatureHeader } from "./sign";
import { assertSafeWebhookUrl, webhookUrlPolicyFromEnv, type WebhookUrlPolicy } from "./ssrf";

export type WebhookDatabase = NodePgDatabase<typeof schema>;

export const webhookRetryDelaysMs = [0, 2_000, 10_000] as const;
export const webhookHttpTimeoutMs = 5_000;
export const maxWebhookErrorLength = 500;

export type DeliveryResult = {
  ok: boolean;
  status: "delivered" | "failed";
  responseStatus: number | null;
  error: string | null;
  deliveryId: string;
};

type DeliverOptions = {
  policy?: WebhookUrlPolicy;
  resolve?: (hostname: string) => Promise<string[]>;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  maxAttempts?: number;
};

function boundError(message: string) {
  return message.slice(0, maxWebhookErrorLength);
}

function sleepMs(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function postWebhook(
  url: string,
  secret: string,
  payload: WebhookPayload,
  options: DeliverOptions,
) {
  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor((options.now?.() ?? new Date()).getTime() / 1000);
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), webhookHttpTimeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "FormSquid-Event": payload.event,
        "FormSquid-Delivery-Id": payload.id,
        "FormSquid-Signature": webhookSignatureHeader(secret, timestamp, rawBody),
      },
      body: rawBody,
      signal: controller.signal,
      redirect: "error",
    });
    return {
      ok: response.status >= 200 && response.status < 300,
      responseStatus: response.status,
      error: response.status >= 200 && response.status < 300 ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "Request timed out."
          : error.message
        : "Request failed.";
    return { ok: false, responseStatus: null, error: boundError(message) };
  } finally {
    clearTimeout(timer);
  }
}

async function runDeliveryAttempts(
  database: WebhookDatabase,
  input: {
    deliveryId: string;
    webhookId: string;
    url: string;
    secret: string;
    payload: WebhookPayload;
  },
  options: DeliverOptions,
): Promise<DeliveryResult> {
  const policy = options.policy ?? webhookUrlPolicyFromEnv();
  const sleep = options.sleep ?? sleepMs;
  const maxAttempts = options.maxAttempts ?? webhookRetryDelaysMs.length;
  let lastStatus: number | null = null;
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const delay = webhookRetryDelaysMs[attempt - 1] ?? webhookRetryDelaysMs.at(-1)!;
    if (delay > 0) {
      await sleep(delay);
    }

    await database
      .update(webhookDeliveries)
      .set({
        attempt,
        status: "pending",
        responseStatus: null,
        error: null,
      })
      .where(eq(webhookDeliveries.id, input.deliveryId));

    try {
      await assertSafeWebhookUrl(input.url, policy, options.resolve);
    } catch (error) {
      lastError = boundError(error instanceof Error ? error.message : "Unsafe webhook URL.");
      lastStatus = null;
      await database
        .update(webhookDeliveries)
        .set({
          attempt,
          status: attempt === maxAttempts ? "failed" : "pending",
          responseStatus: null,
          error: lastError,
        })
        .where(eq(webhookDeliveries.id, input.deliveryId));
      continue;
    }

    const result = await postWebhook(input.url, input.secret, input.payload, options);
    lastStatus = result.responseStatus;
    lastError = result.error ? boundError(result.error) : null;

    if (result.ok) {
      const deliveredAt = options.now?.() ?? new Date();
      await database
        .update(webhookDeliveries)
        .set({
          attempt,
          status: "delivered",
          responseStatus: result.responseStatus,
          error: null,
          deliveredAt,
        })
        .where(eq(webhookDeliveries.id, input.deliveryId));
      return {
        ok: true,
        status: "delivered",
        responseStatus: result.responseStatus,
        error: null,
        deliveryId: input.deliveryId,
      };
    }

    await database
      .update(webhookDeliveries)
      .set({
        attempt,
        status: attempt === maxAttempts ? "failed" : "pending",
        responseStatus: result.responseStatus,
        error: lastError,
      })
      .where(eq(webhookDeliveries.id, input.deliveryId));
  }

  return {
    ok: false,
    status: "failed",
    responseStatus: lastStatus,
    error: lastError,
    deliveryId: input.deliveryId,
  };
}

export async function deliverSubmissionWebhook(
  database: WebhookDatabase,
  dispatch: SubmissionDispatch,
  options: DeliverOptions = {},
): Promise<DeliveryResult | null> {
  const [webhook] = await database
    .select()
    .from(formWebhooks)
    .where(and(eq(formWebhooks.formId, dispatch.formId), eq(formWebhooks.enabled, true)));
  if (!webhook) {
    return null;
  }

  const deliveryId = randomUUID();
  const createdAt = options.now?.() ?? new Date();
  await database.insert(webhookDeliveries).values({
    id: deliveryId,
    webhookId: webhook.id,
    submissionId: dispatch.submissionId,
    attempt: 0,
    status: "pending",
    createdAt,
  });

  const payload = buildWebhookPayload({
    deliveryId,
    event: submissionCreatedEvent,
    createdAt: createdAt.toISOString(),
    form: {
      id: dispatch.formId,
      slug: dispatch.formSlug,
      title: dispatch.formTitle,
      version: dispatch.version,
    },
    submission: {
      id: dispatch.submissionId,
      createdAt: dispatch.createdAt,
      data: dispatch.data,
    },
  });

  return runDeliveryAttempts(
    database,
    {
      deliveryId,
      webhookId: webhook.id,
      url: webhook.url,
      secret: webhook.secret,
      payload,
    },
    options,
  );
}

export async function deliverTestWebhook(
  database: WebhookDatabase,
  input: {
    formId: string;
    formSlug: string;
    formTitle: string;
    version: number;
    data: SubmissionData;
  },
  options: DeliverOptions = {},
): Promise<DeliveryResult> {
  const [webhook] = await database.select().from(formWebhooks).where(eq(formWebhooks.formId, input.formId));
  if (!webhook) {
    throw new Error("Save a webhook before sending a test.");
  }

  const deliveryId = randomUUID();
  const createdAt = options.now?.() ?? new Date();
  await database.insert(webhookDeliveries).values({
    id: deliveryId,
    webhookId: webhook.id,
    submissionId: null,
    attempt: 0,
    status: "pending",
    createdAt,
  });

  const payload = buildWebhookPayload({
    deliveryId,
    event: submissionTestEvent,
    createdAt: createdAt.toISOString(),
    form: {
      id: input.formId,
      slug: input.formSlug,
      title: input.formTitle,
      version: input.version,
    },
    submission: {
      id: `test_${deliveryId}`,
      createdAt: createdAt.toISOString(),
      data: input.data,
    },
  });

  return runDeliveryAttempts(
    database,
    {
      deliveryId,
      webhookId: webhook.id,
      url: webhook.url,
      secret: webhook.secret,
      payload,
    },
    { ...options, maxAttempts: 1 },
  );
}

export async function retryWebhookDelivery(
  database: WebhookDatabase,
  input: { formId: string; deliveryId: string },
  options: DeliverOptions = {},
): Promise<DeliveryResult> {
  const [existing] = await database
    .select({
      delivery: webhookDeliveries,
      webhook: formWebhooks,
    })
    .from(webhookDeliveries)
    .innerJoin(formWebhooks, eq(webhookDeliveries.webhookId, formWebhooks.id))
    .where(and(eq(webhookDeliveries.id, input.deliveryId), eq(formWebhooks.formId, input.formId)));

  if (!existing) {
    throw new Error("Delivery not found");
  }
  if (!existing.delivery.submissionId) {
    throw new Error("Test deliveries cannot be retried. Send a new test instead.");
  }

  const [submission] = await database
    .select()
    .from(submissions)
    .where(eq(submissions.id, existing.delivery.submissionId));
  if (!submission || submission.formId !== input.formId) {
    throw new Error("Submission not found");
  }

  const [form] = await database.select().from(forms).where(eq(forms.id, input.formId));
  if (!form) {
    throw new Error("Form not found");
  }

  const [version] = await database
    .select()
    .from(formVersions)
    .where(eq(formVersions.id, submission.formVersionId));
  if (!version) {
    throw new Error("Form version not found");
  }

  const spec = formSpecSchema.parse(version.spec);
  const result = await deliverSubmissionWebhook(
    database,
    {
      submissionId: submission.id,
      formId: form.id,
      formSlug: form.slug,
      formTitle: spec.title || form.slug,
      version: version.versionNumber,
      createdAt: submission.createdAt.toISOString(),
      data: submission.payload as SubmissionData,
    },
    options,
  );
  if (!result) {
    throw new Error("Webhook is disabled or missing.");
  }
  return result;
}

export async function listRecentDeliveries(database: WebhookDatabase, webhookId: string, limit = 20) {
  return database
    .select()
    .from(webhookDeliveries)
    .where(eq(webhookDeliveries.webhookId, webhookId))
    .orderBy(desc(webhookDeliveries.createdAt))
    .limit(limit);
}

export function testDataForSpec(spec: FormSpec) {
  return sampleSubmissionData(spec);
}

export function assertWebhookOwnedByForm(webhookFormId: string, formId: string) {
  if (webhookFormId !== formId) {
    throw new Error("Webhook not found");
  }
}
