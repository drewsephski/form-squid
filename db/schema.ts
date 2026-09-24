import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
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
  (table) => [index("submissions_form_id_idx").on(table.formId)],
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
