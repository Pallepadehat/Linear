ALTER TYPE "public"."activity_kind" ADD VALUE 'due_date';--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "due_date" date;--> statement-breakpoint
CREATE INDEX "issues_workspace_id_due_date_id_index" ON "issues" USING btree ("workspace_id","due_date","id");