ALTER TYPE "public"."activity_kind" ADD VALUE 'parent';--> statement-breakpoint
ALTER TYPE "public"."activity_kind" ADD VALUE 'sub_issue';--> statement-breakpoint
ALTER TABLE "issues" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "issues" ADD CONSTRAINT "issues_parent_id_issues_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."issues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issues_parent_id_index" ON "issues" USING btree ("parent_id");