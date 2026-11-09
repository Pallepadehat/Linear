CREATE TYPE "public"."pull_request_link_type" AS ENUM('closing', 'reference');--> statement-breakpoint
CREATE TYPE "public"."pull_request_state" AS ENUM('open', 'draft', 'closed', 'merged');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('received', 'processed', 'ignored', 'failed');--> statement-breakpoint
CREATE TABLE "github_installations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"installation_id" bigint NOT NULL,
	"workspace_id" uuid NOT NULL,
	"account_login" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_installations_installationId_unique" UNIQUE("installation_id")
);
--> statement-breakpoint
CREATE TABLE "github_repositories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"github_repo_id" bigint NOT NULL,
	"workspace_id" uuid NOT NULL,
	"installation_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "github_repositories_githubRepoId_unique" UNIQUE("github_repo_id")
);
--> statement-breakpoint
CREATE TABLE "issue_pull_request_links" (
	"id" uuid PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"issue_id" uuid NOT NULL,
	"pull_request_id" uuid NOT NULL,
	"type" "pull_request_link_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_pull_request_links_issue_id_pull_request_id_unique" UNIQUE("issue_id","pull_request_id")
);
--> statement-breakpoint
CREATE TABLE "pull_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"github_pr_id" bigint NOT NULL,
	"repository_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"branch" text NOT NULL,
	"state" "pull_request_state" NOT NULL,
	"merged_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pull_requests_githubPrId_unique" UNIQUE("github_pr_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"delivery_id" text NOT NULL,
	"event" text NOT NULL,
	"status" "webhook_delivery_status" DEFAULT 'received' NOT NULL,
	"error" text,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_deliveries_deliveryId_unique" UNIQUE("delivery_id")
);
--> statement-breakpoint
ALTER TABLE "github_installations" ADD CONSTRAINT "github_installations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repositories" ADD CONSTRAINT "github_repositories_installation_id_github_installations_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."github_installations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_pull_request_links" ADD CONSTRAINT "issue_pull_request_links_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_pull_request_links" ADD CONSTRAINT "issue_pull_request_links_issue_id_issues_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_pull_request_links" ADD CONSTRAINT "issue_pull_request_links_pull_request_id_pull_requests_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."pull_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_repository_id_github_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."github_repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "github_installations_workspace_id_index" ON "github_installations" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "github_repositories_workspace_id_index" ON "github_repositories" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "github_repositories_installation_id_index" ON "github_repositories" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "issue_pull_request_links_workspace_id_index" ON "issue_pull_request_links" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "issue_pull_request_links_pull_request_id_index" ON "issue_pull_request_links" USING btree ("pull_request_id");--> statement-breakpoint
CREATE INDEX "pull_requests_workspace_id_index" ON "pull_requests" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "pull_requests_repository_id_index" ON "pull_requests" USING btree ("repository_id");