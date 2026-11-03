CREATE TYPE "public"."issue_relation_type" AS ENUM('blocks', 'related', 'duplicate');--> statement-breakpoint
ALTER TYPE "public"."activity_kind" ADD VALUE 'relation';--> statement-breakpoint
CREATE TABLE "issue_relations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"related_issue_id" uuid NOT NULL,
	"type" "issue_relation_type" NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_relations_issue_id_related_issue_id_type_unique" UNIQUE("issue_id","related_issue_id","type"),
	CONSTRAINT "issue_relations_not_self" CHECK ("issue_relations"."issue_id" <> "issue_relations"."related_issue_id")
);
--> statement-breakpoint
ALTER TABLE "issue_relations" ADD CONSTRAINT "issue_relations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_relations" ADD CONSTRAINT "issue_relations_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_relations" ADD CONSTRAINT "issue_relations_related_issue_id_issues_id_fk" FOREIGN KEY ("related_issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_relations" ADD CONSTRAINT "issue_relations_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "issue_relations_pair_type_unique" ON "issue_relations" USING btree (least("issue_id", "related_issue_id"),greatest("issue_id", "related_issue_id"),"type");--> statement-breakpoint
CREATE INDEX "issue_relations_related_issue_id_index" ON "issue_relations" USING btree ("related_issue_id");--> statement-breakpoint
CREATE INDEX "issue_relations_workspace_id_index" ON "issue_relations" USING btree ("workspace_id");