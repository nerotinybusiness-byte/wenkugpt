import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  conceptAliases,
  conceptDefinitionVersions,
  conceptEvidence,
  concepts,
  definitionReviews,
  termCandidates,
  type CandidateStatus,
  type ConceptCriticality,
  type ConceptStatus,
} from '@/lib/db/schema';

interface ApprovalInput {
  reviewerId?: string;
  conceptKey: string;
  conceptLabel: string;
  definition: string;
  confidence?: number;
  status?: ConceptStatus;
  criticality?: ConceptCriticality;
  sourceOfTruthDocId?: string;
}

interface ReviewListFilters {
  status?: CandidateStatus;
  limit?: number;
}

function normalizeTerm(term: string): string {
  return term
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_:-]/gu, ' ')
    .replace(/\s+/g, ' ');
}

export async function listDefinitionReviewQueue(filters: ReviewListFilters = {}) {
  const status = filters.status ?? 'pending';
  const limit = filters.limit ?? 50;

  return db
    .select()
    .from(termCandidates)
    .where(eq(termCandidates.status, status))
    .orderBy(desc(termCandidates.detectedAt))
    .limit(limit);
}

export async function approveTermCandidate(candidateId: string, input: ApprovalInput) {
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select()
      .from(termCandidates)
      .where(eq(termCandidates.id, candidateId))
      .limit(1);

    if (!candidate) {
      throw new Error(`Term candidate not found: ${candidateId}`);
    }

    const normalizedConceptKey = input.conceptKey.trim().toUpperCase();
    if (!normalizedConceptKey) {
      throw new Error('conceptKey is required');
    }

    const [existingConcept] = await tx
      .select()
      .from(concepts)
      .where(eq(concepts.key, normalizedConceptKey))
      .limit(1);

    let conceptId = existingConcept?.id;
    if (!conceptId) {
      const [createdConcept] = await tx
        .insert(concepts)
        .values({
          key: normalizedConceptKey,
          label: input.conceptLabel.trim(),
          description: candidate.suggestedDefinition ?? null,
          status: input.status ?? 'approved',
          criticality: input.criticality ?? 'normal',
          definedBy: input.reviewerId ?? null,
          approvedBy: input.reviewerId ?? null,
        })
        .returning();
      conceptId = createdConcept.id;
    }

    const [latestDefinition] = await tx
      .select({ version: conceptDefinitionVersions.version })
      .from(conceptDefinitionVersions)
      .where(eq(conceptDefinitionVersions.conceptId, conceptId))
      .orderBy(desc(conceptDefinitionVersions.version))
      .limit(1);

    const nextVersion = (latestDefinition?.version ?? 0) + 1;
    const [definitionVersion] = await tx
      .insert(conceptDefinitionVersions)
      .values({
        conceptId,
        version: nextVersion,
        definition: input.definition.trim(),
        status: 'approved',
        confidence: input.confidence ?? candidate.confidence ?? 0.7,
        team: candidate.team,
        product: candidate.product,
        region: candidate.region,
        process: candidate.process,
        role: candidate.role,
        definedBy: input.reviewerId ?? null,
        approvedBy: input.reviewerId ?? null,
        sourceOfTruthDocId: input.sourceOfTruthDocId ?? candidate.documentId,
      })
      .returning();

    const aliasNormalized = normalizeTerm(candidate.termOriginal);
    const existingAlias = await tx
      .select({ id: conceptAliases.id })
      .from(conceptAliases)
      .where(and(
        eq(conceptAliases.conceptId, conceptId),
        eq(conceptAliases.aliasNormalized, aliasNormalized),
      ))
      .limit(1);

    let aliasId: string | null = null;
    if (existingAlias.length > 0) {
      aliasId = existingAlias[0].id;
    } else {
      const [createdAlias] = await tx
        .insert(conceptAliases)
        .values({
          conceptId,
          alias: candidate.termOriginal,
          aliasNormalized,
          team: candidate.team,
          product: candidate.product,
          region: candidate.region,
          process: candidate.process,
          role: candidate.role,
          status: 'active',
          confidence: candidate.confidence,
          definedBy: input.reviewerId ?? null,
          approvedBy: input.reviewerId ?? null,
        })
        .returning();
      aliasId = createdAlias.id;
    }

    if (candidate.contexts.length > 0 || candidate.documentId) {
      await tx.insert(conceptEvidence).values({
        conceptId,
        definitionVersionId: definitionVersion.id,
        aliasId,
        documentId: candidate.documentId,
        sourceType: candidate.sourceType,
        excerpt: candidate.contexts[0] ?? candidate.suggestedDefinition ?? candidate.termOriginal,
        author: candidate.author,
        team: candidate.team,
        product: candidate.product,
        region: candidate.region,
        process: candidate.process,
        role: candidate.role,
      });
    }

    await tx
      .update(termCandidates)
      .set({
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: input.reviewerId ?? null,
        candidateConceptKey: normalizedConceptKey,
        updatedAt: new Date(),
      })
      .where(eq(termCandidates.id, candidateId));

    await tx.insert(definitionReviews).values({
      candidateId: candidate.id,
      conceptId,
      definitionVersionId: definitionVersion.id,
      reviewerId: input.reviewerId ?? null,
      decision: 'approved',
      notes: 'Approved via review workflow',
    });

    return {
      candidateId: candidate.id,
      conceptId,
      definitionVersionId: definitionVersion.id,
      aliasId,
    };
  });
}

export async function rejectTermCandidate(candidateId: string, reviewerId?: string, notes?: string) {
  return db.transaction(async (tx) => {
    const [candidate] = await tx
      .select()
      .from(termCandidates)
      .where(eq(termCandidates.id, candidateId))
      .limit(1);

    if (!candidate) {
      throw new Error(`Term candidate not found: ${candidateId}`);
    }

    await tx
      .update(termCandidates)
      .set({
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: reviewerId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(termCandidates.id, candidateId));

    await tx.insert(definitionReviews).values({
      candidateId: candidate.id,
      conceptId: null,
      definitionVersionId: null,
      reviewerId: reviewerId ?? null,
      decision: 'rejected',
      notes: notes ?? 'Rejected via review workflow',
    });

    return { candidateId: candidate.id, status: 'rejected' as const };
  });
}
