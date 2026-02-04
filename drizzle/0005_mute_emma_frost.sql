CREATE TABLE "plan_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weekly_plan_id" uuid NOT NULL,
	"day_of_week" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"topic" text NOT NULL,
	"activities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"week_number" integer NOT NULL,
	"week_start_date" timestamp NOT NULL,
	"focus_area" text NOT NULL,
	"total_minutes" integer NOT NULL,
	"completion_percentage" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plan_sessions" ADD CONSTRAINT "plan_sessions_weekly_plan_id_weekly_plans_id_fk" FOREIGN KEY ("weekly_plan_id") REFERENCES "public"."weekly_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_plans" ADD CONSTRAINT "weekly_plans_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plan_sessions_weekly_plan_id_idx" ON "plan_sessions" USING btree ("weekly_plan_id");--> statement-breakpoint
CREATE INDEX "plan_sessions_status_idx" ON "plan_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "weekly_plans_goal_id_idx" ON "weekly_plans" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "weekly_plans_week_start_date_idx" ON "weekly_plans" USING btree ("week_start_date");