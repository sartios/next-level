ALTER TABLE "challenge_progress" ADD COLUMN "status" text DEFAULT 'not_started' NOT NULL;--> statement-breakpoint
ALTER TABLE "challenge_progress" DROP COLUMN "is_complete";