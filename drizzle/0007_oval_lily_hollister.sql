CREATE TABLE "challenge_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"visitor_id" text NOT NULL,
	"current_question_index" integer DEFAULT 0 NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"correct_answers" integer DEFAULT 0 NOT NULL,
	"earned_points" integer DEFAULT 0 NOT NULL,
	"is_complete" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"last_activity_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "challenge_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"question_number" integer NOT NULL,
	"question" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_answer" text NOT NULL,
	"explanation" text NOT NULL,
	"hint" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"section_title" text NOT NULL,
	"section_topics" jsonb DEFAULT '[]'::jsonb,
	"difficulty" text DEFAULT 'easy' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"total_questions" integer DEFAULT 10 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "challenge_progress" ADD CONSTRAINT "challenge_progress_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge_questions" ADD CONSTRAINT "challenge_questions_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_section_id_learning_resource_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."learning_resource_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "challenge_progress_challenge_id_idx" ON "challenge_progress" USING btree ("challenge_id");--> statement-breakpoint
CREATE INDEX "challenge_progress_visitor_id_idx" ON "challenge_progress" USING btree ("visitor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_progress_challenge_visitor_unique" ON "challenge_progress" USING btree ("challenge_id","visitor_id");--> statement-breakpoint
CREATE INDEX "challenge_questions_challenge_id_idx" ON "challenge_questions" USING btree ("challenge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_questions_challenge_number_unique" ON "challenge_questions" USING btree ("challenge_id","question_number");--> statement-breakpoint
CREATE INDEX "challenges_goal_id_idx" ON "challenges" USING btree ("goal_id");--> statement-breakpoint
CREATE INDEX "challenges_section_id_idx" ON "challenges" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "challenges_status_idx" ON "challenges" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "challenges_goal_section_difficulty_unique" ON "challenges" USING btree ("goal_id","section_id","difficulty");