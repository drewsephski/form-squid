CREATE TABLE "submission_rate_buckets" (
	"form_id" text NOT NULL,
	"actor_hash" text NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"attempts" integer NOT NULL,
	CONSTRAINT "submission_rate_buckets_form_id_actor_hash_bucket_start_pk" PRIMARY KEY("form_id","actor_hash","bucket_start")
);
--> statement-breakpoint
ALTER TABLE "submission_rate_buckets" ADD CONSTRAINT "submission_rate_buckets_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "submission_rate_buckets_start_idx" ON "submission_rate_buckets" USING btree ("bucket_start");