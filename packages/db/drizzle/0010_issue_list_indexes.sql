CREATE INDEX "issues_workspace_id_priority_index" ON "issues" USING btree ("workspace_id","priority");--> statement-breakpoint
CREATE INDEX "issues_workspace_id_created_at_id_index" ON "issues" USING btree ("workspace_id","created_at","id");--> statement-breakpoint
CREATE INDEX "issues_workspace_id_updated_at_id_index" ON "issues" USING btree ("workspace_id","updated_at","id");