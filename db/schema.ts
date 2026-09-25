import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";

export * from "./auth-schema";

export const forms = pgTable(
  "forms",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    draftSlug: text("draft_slug").notNull(),
    notifyEmail: text("notify_email"),
    registryKey: text("registry_key").notNull(),
    draftSpec: jsonb("draft_spec").notNull(),
    currentPublishedVersionId: text("current_published_version_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("forms_slug_unique").on(table.slug),
    uniqueIndex("forms_registry_key_unique").on(table.registryKey),
    index("forms_user_id_idx").on(table.userId),
  ],
);

export const formVersions = pgTable(
  "form_versions",
  {
    id: text("id").primaryKey(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    spec: jsonb("spec").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("form_versions_form_number_unique").on(table.formId, table.versionNumber),
    index("form_versions_form_id_idx").on(table.formId),
  ],
);

export const submissions = pgTable(
  "submissions",
  {
    id: text("id").primaryKey(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    formVersionId: text("form_version_id")
      .notNull()
      .references(() => formVersions.id, { onDelete: "cascade" }),
    payload: jsonb("payload").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("submissions_form_id_idx").on(table.formId),
    index("submissions_form_created_idx").on(table.formId, table.createdAt),
  ],
);

export const submissionRateBuckets = pgTable(
  "submission_rate_buckets",
  {
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    actorHash: text("actor_hash").notNull(),
    bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
    attempts: integer("attempts").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.formId, table.actorHash, table.bucketStart] }),
    index("submission_rate_buckets_start_idx").on(table.bucketStart),
  ],
);

export const generationEvents = pgTable(
  "generation_events",
  {
    id: text("id").primaryKey(),
    actorKey: text("actor_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("generation_events_actor_idx").on(table.actorKey, table.createdAt)],
);

export const formWebhooks = pgTable(
  "form_webhooks",
  {
    id: text("id").primaryKey(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secret: text("secret").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("form_webhooks_form_id_unique").on(table.formId)],
);

export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: text("id").primaryKey(),
    webhookId: text("webhook_id")
      .notNull()
      .references(() => formWebhooks.id, { onDelete: "cascade" }),
    submissionId: text("submission_id").references(() => submissions.id, { onDelete: "cascade" }),
    attempt: integer("attempt").notNull().default(0),
    status: text("status").notNull(),
    responseStatus: integer("response_status"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (table) => [
    index("webhook_deliveries_webhook_created_idx").on(table.webhookId, table.createdAt),
    index("webhook_deliveries_submission_idx").on(table.submissionId),
  ],
);

export const submissionFiles = pgTable(
  "submission_files",
  {
    id: text("id").primaryKey(),
    formId: text("form_id")
      .notNull()
      .references(() => forms.id, { onDelete: "cascade" }),
    submissionId: text("submission_id").references(() => submissions.id, { onDelete: "cascade" }),
    fieldId: text("field_id").notNull(),
    storageKey: text("storage_key").notNull(),
    originalFilename: text("original_filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    actorHash: text("actor_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("submission_files_storage_key_unique").on(table.storageKey),
    index("submission_files_form_id_idx").on(table.formId),
    index("submission_files_submission_id_idx").on(table.submissionId),
    index("submission_files_pending_created_idx").on(table.createdAt),
    index("submission_files_form_actor_idx").on(table.formId, table.actorHash),
  ],
);
