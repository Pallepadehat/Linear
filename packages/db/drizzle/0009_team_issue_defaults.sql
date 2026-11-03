ALTER TABLE "teams" ADD COLUMN "default_status_id" uuid;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "default_priority" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN "default_assignee_id" uuid;--> statement-breakpoint
ALTER TABLE "workflow_statuses" ADD CONSTRAINT "workflow_statuses_team_id_id_unique" UNIQUE("team_id","id");--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_default_assignee_id_users_id_fk" FOREIGN KEY ("default_assignee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_default_status_fk" FOREIGN KEY ("id","default_status_id") REFERENCES "public"."workflow_statuses"("team_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_default_priority_range" CHECK ("teams"."default_priority" between 0 and 4);--> statement-breakpoint
-- Backfill with the built-in rule: `Backlog`, else the first `backlog` status, else the first `unstarted` one.
UPDATE "teams" SET "default_status_id" = (
  SELECT "s"."id" FROM "workflow_statuses" "s"
  WHERE "s"."team_id" = "teams"."id" AND "s"."category" IN ('backlog', 'unstarted')
  ORDER BY ("s"."name" = 'Backlog') DESC, ("s"."category" = 'backlog') DESC, "s"."position" ASC
  LIMIT 1
);
