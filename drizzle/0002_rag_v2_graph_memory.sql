CREATE TABLE "concepts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(128) NOT NULL,
	"label" varchar(256) NOT NULL,
	"description" text,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"criticality" varchar(32) DEFAULT 'normal' NOT NULL,
	"defined_by" uuid,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concept_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"concept_id" uuid NOT NULL,
	"alias" varchar(256) NOT NULL,
	"alias_normalized" varchar(256) NOT NULL,
	"language" varchar(16) DEFAULT 'cs' NOT NULL,
	"team" varchar(128),
	"product" varchar(128),
	"region" varchar(128),
	"process" varchar(128),
	"role" varchar(128),
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"defined_by" uuid,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concept_definition_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"concept_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"definition" text NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"confidence" real DEFAULT 0.7 NOT NULL,
	"team" varchar(128),
	"product" varchar(128),
	"region" varchar(128),
	"process" varchar(128),
	"role" varchar(128),
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"defined_by" uuid,
	"approved_by" uuid,
	"source_of_truth_doc_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concept_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_concept_id" uuid NOT NULL,
	"to_concept_id" uuid NOT NULL,
	"relation_type" varchar(32) NOT NULL,
	"weight" real DEFAULT 1 NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"confidence" real DEFAULT 0.7 NOT NULL,
	"team" varchar(128),
	"product" varchar(128),
	"region" varchar(128),
	"process" varchar(128),
	"role" varchar(128),
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"defined_by" uuid,
	"approved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "concept_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"concept_id" uuid NOT NULL,
	"definition_version_id" uuid,
	"alias_id" uuid,
	"document_id" uuid,
	"source_type" varchar(64) DEFAULT 'document' NOT NULL,
	"source_url" varchar(2048),
	"excerpt" text NOT NULL,
	"author" varchar(256),
	"team" varchar(128),
	"product" varchar(128),
	"region" varchar(128),
	"process" varchar(128),
	"role" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "term_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term_original" varchar(256) NOT NULL,
	"term_normalized" varchar(256) NOT NULL,
	"contexts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"frequency" integer DEFAULT 1 NOT NULL,
	"source_type" varchar(64) DEFAULT 'document' NOT NULL,
	"document_id" uuid,
	"author" varchar(256),
	"team" varchar(128),
	"product" varchar(128),
	"region" varchar(128),
	"process" varchar(128),
	"role" varchar(128),
	"candidate_concept_key" varchar(128),
	"suggested_definition" text,
	"confidence" real DEFAULT 0.3 NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "definition_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid,
	"concept_id" uuid,
	"definition_version_id" uuid,
	"reviewer_id" uuid,
	"decision" varchar(32) NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_defined_by_users_id_fk" FOREIGN KEY ("defined_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concepts" ADD CONSTRAINT "concepts_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_aliases" ADD CONSTRAINT "concept_aliases_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_aliases" ADD CONSTRAINT "concept_aliases_defined_by_users_id_fk" FOREIGN KEY ("defined_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_aliases" ADD CONSTRAINT "concept_aliases_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_definition_versions" ADD CONSTRAINT "concept_definition_versions_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_definition_versions" ADD CONSTRAINT "concept_definition_versions_defined_by_users_id_fk" FOREIGN KEY ("defined_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_definition_versions" ADD CONSTRAINT "concept_definition_versions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_definition_versions" ADD CONSTRAINT "concept_definition_versions_source_of_truth_doc_id_documents_id_fk" FOREIGN KEY ("source_of_truth_doc_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_relationships" ADD CONSTRAINT "concept_relationships_from_concept_id_concepts_id_fk" FOREIGN KEY ("from_concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_relationships" ADD CONSTRAINT "concept_relationships_to_concept_id_concepts_id_fk" FOREIGN KEY ("to_concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_relationships" ADD CONSTRAINT "concept_relationships_defined_by_users_id_fk" FOREIGN KEY ("defined_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_relationships" ADD CONSTRAINT "concept_relationships_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_evidence" ADD CONSTRAINT "concept_evidence_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_evidence" ADD CONSTRAINT "concept_evidence_definition_version_id_concept_definition_versions_id_fk" FOREIGN KEY ("definition_version_id") REFERENCES "public"."concept_definition_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_evidence" ADD CONSTRAINT "concept_evidence_alias_id_concept_aliases_id_fk" FOREIGN KEY ("alias_id") REFERENCES "public"."concept_aliases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "concept_evidence" ADD CONSTRAINT "concept_evidence_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_candidates" ADD CONSTRAINT "term_candidates_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "term_candidates" ADD CONSTRAINT "term_candidates_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "definition_reviews" ADD CONSTRAINT "definition_reviews_candidate_id_term_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."term_candidates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "definition_reviews" ADD CONSTRAINT "definition_reviews_concept_id_concepts_id_fk" FOREIGN KEY ("concept_id") REFERENCES "public"."concepts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "definition_reviews" ADD CONSTRAINT "definition_reviews_definition_version_id_concept_definition_versions_id_fk" FOREIGN KEY ("definition_version_id") REFERENCES "public"."concept_definition_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "definition_reviews" ADD CONSTRAINT "definition_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "concepts_key_unique_idx" ON "concepts" USING btree ("key");--> statement-breakpoint
CREATE INDEX "concepts_status_idx" ON "concepts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "concept_aliases_unique_scope_idx" ON "concept_aliases" USING btree ("alias_normalized","team","product","region","process","role","valid_from");--> statement-breakpoint
CREATE INDEX "concept_aliases_lookup_idx" ON "concept_aliases" USING btree ("alias_normalized","status");--> statement-breakpoint
CREATE INDEX "concept_aliases_concept_idx" ON "concept_aliases" USING btree ("concept_id");--> statement-breakpoint
CREATE INDEX "concept_aliases_validity_idx" ON "concept_aliases" USING btree ("valid_from","valid_to");--> statement-breakpoint
CREATE UNIQUE INDEX "concept_definition_version_unique_idx" ON "concept_definition_versions" USING btree ("concept_id","version");--> statement-breakpoint
CREATE INDEX "concept_definition_status_idx" ON "concept_definition_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "concept_definition_validity_idx" ON "concept_definition_versions" USING btree ("valid_from","valid_to");--> statement-breakpoint
CREATE INDEX "concept_definition_scope_idx" ON "concept_definition_versions" USING btree ("team","product");--> statement-breakpoint
CREATE UNIQUE INDEX "concept_relationship_unique_idx" ON "concept_relationships" USING btree ("from_concept_id","to_concept_id","relation_type","team","product","region","process","role","valid_from");--> statement-breakpoint
CREATE INDEX "concept_relationship_from_idx" ON "concept_relationships" USING btree ("from_concept_id");--> statement-breakpoint
CREATE INDEX "concept_relationship_to_idx" ON "concept_relationships" USING btree ("to_concept_id");--> statement-breakpoint
CREATE INDEX "concept_relationship_validity_idx" ON "concept_relationships" USING btree ("valid_from","valid_to");--> statement-breakpoint
CREATE INDEX "concept_relationship_status_idx" ON "concept_relationships" USING btree ("status");--> statement-breakpoint
CREATE INDEX "concept_evidence_concept_idx" ON "concept_evidence" USING btree ("concept_id");--> statement-breakpoint
CREATE INDEX "concept_evidence_definition_idx" ON "concept_evidence" USING btree ("definition_version_id");--> statement-breakpoint
CREATE INDEX "concept_evidence_doc_idx" ON "concept_evidence" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "concept_evidence_scope_idx" ON "concept_evidence" USING btree ("team","product");--> statement-breakpoint
CREATE UNIQUE INDEX "term_candidates_unique_idx" ON "term_candidates" USING btree ("term_normalized","document_id");--> statement-breakpoint
CREATE INDEX "term_candidates_status_idx" ON "term_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "term_candidates_lookup_idx" ON "term_candidates" USING btree ("term_normalized");--> statement-breakpoint
CREATE INDEX "term_candidates_scope_idx" ON "term_candidates" USING btree ("team","product");--> statement-breakpoint
CREATE INDEX "definition_reviews_candidate_idx" ON "definition_reviews" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "definition_reviews_concept_idx" ON "definition_reviews" USING btree ("concept_id");--> statement-breakpoint
CREATE INDEX "definition_reviews_reviewer_idx" ON "definition_reviews" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "definition_reviews_created_idx" ON "definition_reviews" USING btree ("created_at");
