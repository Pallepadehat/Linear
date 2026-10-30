CREATE TYPE "public"."activity_actor_type" AS ENUM('user', 'github');--> statement-breakpoint
CREATE TYPE "public"."activity_kind" AS ENUM('created', 'title', 'description', 'status', 'priority', 'assignee', 'project', 'labels');--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"actor_type" "activity_actor_type" NOT NULL,
	"actor_id" uuid,
	"kind" "activity_kind" NOT NULL,
	"from" jsonb,
	"to" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_log_github_has_no_actor" CHECK ("activity_log"."actor_type" <> 'github' or "activity_log"."actor_id" is null)
);
--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_log_issue_id_id_index" ON "activity_log" USING btree ("issue_id","id");--> statement-breakpoint
CREATE INDEX "activity_log_workspace_id_index" ON "activity_log" USING btree ("workspace_id");