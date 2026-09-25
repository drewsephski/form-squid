CREATE TABLE "submission_files" (
	"id" text PRIMARY KEY NOT NULL,
	"form_id" text NOT NULL,
	"submission_id" text,
	"field_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"actor_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submission_files" ADD CONSTRAINT "submission_files_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "submission_files_storage_key_unique" ON "submission_files" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "submission_files_form_id_idx" ON "submission_files" USING btree ("form_id");--> statement-breakpoint
CREATE INDEX "submission_files_submission_id_idx" ON "submission_files" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "submission_files_pending_created_idx" ON "submission_files" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "submission_files_form_actor_idx" ON "submission_files" USING btree ("form_id","actor_hash");