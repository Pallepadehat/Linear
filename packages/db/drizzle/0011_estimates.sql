CREATE TYPE "public"."estimate_scale" AS ENUM('off', 'linear', 'fibonacci', 'exponential', 'tshirt');--> statement-breakpoint
ALTER TYPE "public"."activity_kind" ADD VALUE 'estimate';--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "estimate_scale" "estimate_scale" DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "estimate_allow_zero" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "estimate" integer;--> statement-breakpoint
CREATE INDEX "issues_workspace_id_estimate_index" ON "issues" USING btree ("workspace_id","estimate");--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_estimate_range" CHECK ("issues"."estimate" between 0 and 100);