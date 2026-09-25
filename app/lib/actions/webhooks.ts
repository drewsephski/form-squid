"use server";

import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { requireFormOwner, requireUser } from "@/app/lib/auth-guards";
import { formSpecSchema } from "@/app/lib/definitions";
import { db } from "@/db";
import { formVersions, formWebhooks } from "@/db/schema";
import {
  assertWebhookOwnedByForm,
  deliverTestWebhook,
  listRecentDeliveries,
  retryWebhookDelivery,
  testDataForSpec,
} from "@/server/webhooks/deliver";
import { generateWebhookSecret, maskWebhookSecret } from "@/server/webhooks/sign";
import { assertSafeWebhookUrl } from "@/server/webhooks/ssrf";

const maxUrlLength = 2048;

function normalizeWebhookUrl(url: string) {
  const next = url.trim();
  if (!next) {
    throw new Error("Enter a webhook URL.");
  }
  if (next.length > maxUrlLength) {
    throw new Error("Webhook URL is too long.");
  }
  return next;
}

export async function getWebhook(formId: string) {
  const user = await requireUser();
  await requireFormOwner(formId, user.id);
  const [webhook] = await db.select().from(formWebhooks).where(eq(formWebhooks.formId, formId));
  if (!webhook) {
    return null;
  }
  const deliveries = await listRecentDeliveries(db, webhook.id);
  return {
    id: webhook.id,
    url: webhook.url,
    enabled: webhook.enabled,
    hasSecret: true as const,
    secretMasked: maskWebhookSecret(webhook.secret),
    createdAt: webhook.createdAt.toISOString(),
    updatedAt: webhook.updatedAt.toISOString(),
    deliveries: deliveries.map((row) => ({
      id: row.id,
      submissionId: row.submissionId,
      attempt: row.attempt,
      status: row.status,
      responseStatus: row.responseStatus,
      error: row.error,
      createdAt: row.createdAt.toISOString(),
      deliveredAt: row.deliveredAt?.toISOString() ?? null,
    })),
  };
}

export async function saveWebhook(formId: string, url: string, enabled: boolean) {
  const user = await requireUser();
  await requireFormOwner(formId, user.id);
  const nextUrl = normalizeWebhookUrl(url);
  await assertSafeWebhookUrl(nextUrl);

  const [existing] = await db.select().from(formWebhooks).where(eq(formWebhooks.formId, formId));
  const now = new Date();
  if (existing) {
    assertWebhookOwnedByForm(existing.formId, formId);
    await db
      .update(formWebhooks)
      .set({ url: nextUrl, enabled, updatedAt: now })
      .where(eq(formWebhooks.id, existing.id));
    return {
      created: false,
      secret: null as string | null,
      hasSecret: true as const,
      secretMasked: maskWebhookSecret(existing.secret),
    };
  }

  const secret = generateWebhookSecret();
  await db.insert(formWebhooks).values({
    id: randomUUID(),
    formId,
    url: nextUrl,
    secret,
    enabled,
    createdAt: now,
    updatedAt: now,
  });
  return {
    created: true,
    secret,
    hasSecret: true as const,
    secretMasked: maskWebhookSecret(secret),
  };
}

export async function rotateWebhookSecret(formId: string) {
  const user = await requireUser();
  await requireFormOwner(formId, user.id);
  const [existing] = await db.select().from(formWebhooks).where(eq(formWebhooks.formId, formId));
  if (!existing) {
    throw new Error("Save a webhook before rotating the secret.");
  }
  assertWebhookOwnedByForm(existing.formId, formId);
  const secret = generateWebhookSecret();
  await db
    .update(formWebhooks)
    .set({ secret, updatedAt: new Date() })
    .where(eq(formWebhooks.id, existing.id));
  return {
    secret,
    hasSecret: true as const,
    secretMasked: maskWebhookSecret(secret),
  };
}

export async function sendTestWebhook(formId: string) {
  const user = await requireUser();
  const form = await requireFormOwner(formId, user.id);
  const [webhook] = await db.select().from(formWebhooks).where(eq(formWebhooks.formId, formId));
  if (!webhook) {
    throw new Error("Save a webhook before sending a test.");
  }
  assertWebhookOwnedByForm(webhook.formId, formId);

  let versionNumber = 0;
  let spec = formSpecSchema.parse(form.draftSpec);
  if (form.currentPublishedVersionId) {
    const [version] = await db
      .select()
      .from(formVersions)
      .where(eq(formVersions.id, form.currentPublishedVersionId));
    if (version) {
      versionNumber = version.versionNumber;
      spec = formSpecSchema.parse(version.spec);
    }
  }

  const result = await deliverTestWebhook(db, {
    formId: form.id,
    formSlug: form.slug,
    formTitle: spec.title || form.slug,
    version: versionNumber || 1,
    data: testDataForSpec(spec),
  });

  return {
    ok: result.ok,
    status: result.status,
    responseStatus: result.responseStatus,
    error: result.error,
    deliveryId: result.deliveryId,
  };
}

export async function retryFailedDelivery(formId: string, deliveryId: string) {
  const user = await requireUser();
  await requireFormOwner(formId, user.id);
  const [webhook] = await db.select().from(formWebhooks).where(eq(formWebhooks.formId, formId));
  if (!webhook) {
    throw new Error("Webhook not found");
  }
  assertWebhookOwnedByForm(webhook.formId, formId);
  const result = await retryWebhookDelivery(db, { formId, deliveryId });
  return {
    ok: result.ok,
    status: result.status,
    responseStatus: result.responseStatus,
    error: result.error,
    deliveryId: result.deliveryId,
  };
}

export async function deleteWebhook(formId: string) {
  const user = await requireUser();
  await requireFormOwner(formId, user.id);
  await db.delete(formWebhooks).where(eq(formWebhooks.formId, formId));
}
