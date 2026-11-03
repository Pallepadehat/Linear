CREATE TABLE "project_progress_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"date" date NOT NULL,
	"scope" integer NOT NULL,
	"started" integer NOT NULL,
	"completed" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_progress_snapshots_project_id_date_unique" UNIQUE("project_id","date"),
	CONSTRAINT "project_progress_snapshots_counts" CHECK ("project_progress_snapshots"."started" >= 0 and "project_progress_snapshots"."completed" >= 0 and "project_progress_snapshots"."started" + "project_progress_snapshots"."completed" <= "project_progress_snapshots"."scope")
);
--> statement-breakpoint
ALTER TABLE "project_progress_snapshots" ADD CONSTRAINT "project_progress_snapshots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_progress_snapshots" ADD CONSTRAINT "project_progress_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_progress_snapshots_workspace_id_index" ON "project_progress_snapshots" USING btree ("workspace_id");