CREATE TYPE "public"."project_activity_kind" AS ENUM('project.created', 'project.status_changed', 'project.priority_changed', 'project.lead_changed', 'project.dates_changed', 'milestone.created', 'milestone.completed', 'project_update.posted', 'project.issue_added', 'project.issue_removed');--> statement-breakpoint
CREATE TABLE "project_activity" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"actor_type" "activity_actor_type" NOT NULL,
	"actor_id" uuid,
	"kind" "project_activity_kind" NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_activity_github_has_no_actor" CHECK ("project_activity"."actor_type" <> 'github' or "project_activity"."actor_id" is null)
);
--> statement-breakpoint
ALTER TABLE "project_activity" ADD CONSTRAINT "project_activity_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activity" ADD CONSTRAINT "project_activity_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_activity" ADD CONSTRAINT "project_activity_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_activity_project_id_id_index" ON "project_activity" USING btree ("project_id","id");--> statement-breakpoint
CREATE INDEX "project_activity_workspace_id_index" ON "project_activity" USING btree ("workspace_id");