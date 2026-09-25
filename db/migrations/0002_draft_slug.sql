ALTER TABLE "forms" ADD COLUMN "draft_slug" text;--> statement-breakpoint
UPDATE "forms" SET "draft_slug" = "slug" WHERE "draft_slug" IS NULL;--> statement-breakpoint
ALTER TABLE "forms" ALTER COLUMN "draft_slug" SET NOT NULL;
