-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "learning_resource_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"title" text NOT NULL,
	"estimated_minutes" integer,
	"order_index" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"provider" text NOT NULL,
	"resource_type" text NOT NULL,
	"learning_objectives" jsonb DEFAULT '[]'::jsonb,
	"total_hours" numeric(6, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "learning_resources_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "resource_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resource_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"content_index" integer,
	"section_id" uuid,
	"content_text" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"skill_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"level" text NOT NULL,
	CONSTRAINT "skill_resources_unique" UNIQUE("skill_id","resource_id","level")
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"career" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "skills_name_career_unique" UNIQUE("name","career")
);
--> statement-breakpoint
ALTER TABLE "learning_resource_sections" ADD CONSTRAINT "learning_resource_sections_resource_id_learning_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."learning_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_embeddings" ADD CONSTRAINT "resource_embeddings_resource_id_learning_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."learning_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resource_embeddings" ADD CONSTRAINT "resource_embeddings_section_id_learning_resource_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."learning_resource_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_resources" ADD CONSTRAINT "skill_resources_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_resources" ADD CONSTRAINT "skill_resources_resource_id_learning_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."learning_resources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "learning_resource_sections_resource_id_idx" ON "learning_resource_sections" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "learning_resources_url_idx" ON "learning_resources" USING btree ("url");--> statement-breakpoint
CREATE INDEX "learning_resources_provider_idx" ON "learning_resources" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "learning_resources_resource_type_idx" ON "learning_resources" USING btree ("resource_type");--> statement-breakpoint
CREATE INDEX "resource_embeddings_resource_id_idx" ON "resource_embeddings" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "resource_embeddings_content_type_idx" ON "resource_embeddings" USING btree ("content_type");--> statement-breakpoint
CREATE INDEX "resource_embeddings_section_id_idx" ON "resource_embeddings" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "skill_resources_skill_id_idx" ON "skill_resources" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "skill_resources_resource_id_idx" ON "skill_resources" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "skill_resources_level_idx" ON "skill_resources" USING btree ("level");--> statement-breakpoint
CREATE INDEX "skills_name_idx" ON "skills" USING btree ("name");--> statement-breakpoint
CREATE INDEX "skills_career_idx" ON "skills" USING btree ("career");