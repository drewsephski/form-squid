CREATE TABLE "form_webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"form_id" text NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"webhook_id" text NOT NULL,
	"submission_id" text,
	"attempt" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"response_status" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "form_webhooks" ADD CONSTRAINT "form_webhooks_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_form_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."form_webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "form_webhooks_form_id_unique" ON "form_webhooks" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_webhook_created_idx" ON "webhook_deliveries" USING btree ("webhook_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_submission_idx" ON "webhook_deliveries" USING btree ("submission_id");