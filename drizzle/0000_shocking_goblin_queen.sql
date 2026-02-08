CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"query" text NOT NULL,
	"retrieved_chunk_ids" uuid[],
	"draft_response" text,
	"final_response" text,
	"citations" jsonb,
	"confidence_score" real,
	"verification_level" varchar(32) DEFAULT 'basic' NOT NULL,
	"hallucination_detected" boolean DEFAULT false,
	"model_used" varchar(64),
	"latency_ms" integer,
	"tokens_used" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"content" text NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"embedding" vector(768),
	"page_number" integer NOT NULL,
	"bounding_box" jsonb,
	"parent_header" varchar(512),
	"chunk_index" integer NOT NULL,
	"token_count" integer,
	"access_level" varchar(32) DEFAULT 'private' NOT NULL,
	"fts_vector" "tsvector",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"model" varchar(64) DEFAULT 'gemini-1.5-flash' NOT NULL,
	"temperature" real DEFAULT 0 NOT NULL,
	"top_k" integer DEFAULT 5 NOT NULL,
	"verification_level" varchar(32) DEFAULT 'auditor_loop' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "config_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"filename" varchar(512) NOT NULL,
	"file_hash" varchar(64) NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"file_size" integer DEFAULT 0 NOT NULL,
	"page_count" integer,
	"access_level" varchar(32) DEFAULT 'private' NOT NULL,
	"processing_status" varchar(32) DEFAULT 'pending' NOT NULL,
	"processing_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semantic_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_text" text NOT NULL,
	"query_hash" varchar(64) NOT NULL,
	"query_embedding" vector(768),
	"answer_text" text NOT NULL,
	"citations" jsonb,
	"confidence" real DEFAULT 0 NOT NULL,
	"chunk_ids" uuid[],
	"hit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "semantic_cache_query_hash_unique" UNIQUE("query_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"name" varchar(256),
	"image_url" varchar(2048),
	"role" varchar(32) DEFAULT 'user' NOT NULL,
	"daily_prompt_count" integer DEFAULT 0 NOT NULL,
	"last_prompt_reset" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "config" ADD CONSTRAINT "config_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_user_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chunks_document_idx" ON "chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "documents_user_idx" ON "documents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "documents_hash_idx" ON "documents" USING btree ("file_hash");--> statement-breakpoint
CREATE INDEX "semantic_cache_hash_idx" ON "semantic_cache" USING btree ("query_hash");--> statement-breakpoint
CREATE INDEX "semantic_cache_expires_idx" ON "semantic_cache" USING btree ("expires_at");