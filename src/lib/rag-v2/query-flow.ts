import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  conceptAliases,
  conceptDefinitionVersions,
  conceptRelationships,
  concepts,
} from '@/lib/db/schema';
import type { AmbiguityPayload, AmbiguityPolicy, ContextScope, QueryFlowResult, ResolvedConcept } from './types';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';
import { logWarn } from '@/lib/logger';

interface QueryFlowInput {
  query: string;
  contextScope?: ContextScope;
  effectiveAt?: string;
  ambiguityPolicy?: AmbiguityPolicy;
  rewriteEnabled?: boolean;
  graphEnabled?: boolean;
  strictGrounding?: boolean;
}

interface AliasRow {
  alias: string;
  aliasNormalized: string;
  confidence: number;
  team: string | null;
  product: string | null;
  region: string | null;
  process: string | null;
  role: string | null;
  validFrom: Date;
  validTo: Date | null;
  conceptId: string;
  conceptKey: string;
  conceptLabel: string;
  criticality: 'normal' | 'critical';
}

interface DefinitionRow {
  id: string;
  conceptId: string;
  definition: string;
  confidence: number;
  team: string | null;
  product: string | null;
  region: string | null;
  process: string | null;
  role: string | null;
  validFrom: Date;
  validTo: Date | null;
}

interface RelationRow {
  fromConceptId: string;
  toConceptId: string;
  relationType: string;
  team: string | null;
  product: string | null;
  region: string | null;
  process: string | null;
  role: string | null;
  validFrom: Date;
  validTo: Date | null;
}

function normalizeToken(input: string): string {
  return input
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_:-]/gu, ' ')
    .replace(/\s+/g, ' ');
}

function dedupe<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function makeCandidateTerms(query: string): string[] {
  const normalized = normalizeToken(query);
  const words = normalized.split(' ').filter(Boolean);
  const out = new Set<string>();

  for (let i = 0; i < words.length; i += 1) {
    out.add(words[i]);

    if (i + 1 < words.length) {
      out.add(`${words[i]} ${words[i + 1]}`);
    }
    if (i + 2 < words.length) {
      out.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
  }

  // Keep uppercase phrases from raw input as potential aliases.
  const rawUpper = query.match(/\b[A-Z][A-Z0-9_:-]{2,}\b/g) ?? [];
  for (const term of rawUpper) {
    out.add(normalizeToken(term));
  }

  return [...out].filter((term) => term.length > 1);
}

function scopeMatches(
  entityScope: { team: string | null; product: string | null; region: string | null; process: string | null; role: string | null },
  contextScope?: ContextScope,
): boolean {
  if (!contextScope) return true;

  if (entityScope.team && contextScope.team && entityScope.team !== contextScope.team) return false;
  if (entityScope.product && contextScope.product && entityScope.product !== contextScope.product) return false;
  if (entityScope.region && contextScope.region && entityScope.region !== contextScope.region) return false;
  if (entityScope.process && contextScope.process && entityScope.process !== contextScope.process) return false;
  if (entityScope.role && contextScope.role && entityScope.role !== contextScope.role) return false;

  return true;
}

function temporalMatches(validFrom: Date, validTo: Date | null, effectiveAt: Date): boolean {
  if (validFrom > effectiveAt) return false;
  if (validTo && validTo <= effectiveAt) return false;
  return true;
}

function parseEffectiveAt(effectiveAt?: string): Date {
  if (!effectiveAt) return new Date();
  const parsed = new Date(effectiveAt);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

async function classifyTermsWithLlm(query: string): Promise<string[]> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) return [];

  try {
    const google = createGoogleGenerativeAI({ apiKey });
    const response = await generateText({
      model: google('gemini-2.5-flash'),
      temperature: 0,
      prompt: [
        'Extract up to 5 short internal slang terms from the query.',
        'Return JSON only in format: {"terms":["..."]}.',
        `Query: ${query}`,
      ].join('\n'),
    });

    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as { terms?: unknown };
    const terms = Array.isArray(parsed.terms) ? parsed.terms : [];

    return dedupe(
      terms
        .filter((value): value is string => typeof value === 'string')
        .map((value) => normalizeToken(value))
        .filter(Boolean),
    );
  } catch (error) {
    logWarn('RAG v2 fallback classifier failed', { route: 'rag-v2', stage: 'classifier' }, error);
    return [];
  }
}

async function resolveAliases(
  candidateTerms: string[],
  contextScope: ContextScope | undefined,
  effectiveAt: Date,
): Promise<{ resolved: ResolvedConcept[]; matches: AliasRow[]; unresolvedTerms: string[] }> {
  if (candidateTerms.length === 0) {
    return { resolved: [], matches: [], unresolvedTerms: [] };
  }

  const aliasRowsRaw = await db
    .select({
      alias: conceptAliases.alias,
      aliasNormalized: conceptAliases.aliasNormalized,
      confidence: conceptAliases.confidence,
      team: conceptAliases.team,
      product: conceptAliases.product,
      region: conceptAliases.region,
      process: conceptAliases.process,
      role: conceptAliases.role,
      validFrom: conceptAliases.validFrom,
      validTo: conceptAliases.validTo,
      conceptId: concepts.id,
      conceptKey: concepts.key,
      conceptLabel: concepts.label,
      criticality: concepts.criticality,
    })
    .from(conceptAliases)
    .innerJoin(concepts, eq(conceptAliases.conceptId, concepts.id))
    .where(
      and(
        inArray(conceptAliases.aliasNormalized, candidateTerms),
        eq(conceptAliases.status, 'active'),
        eq(concepts.status, 'approved'),
      ),
    );

  const aliasRows = (aliasRowsRaw as AliasRow[]).filter((row) => (
    scopeMatches(row, contextScope)
    && temporalMatches(row.validFrom, row.validTo, effectiveAt)
  ));

  if (aliasRows.length === 0) {
    return {
      resolved: [],
      matches: [],
      unresolvedTerms: candidateTerms,
    };
  }

  const conceptIds = dedupe(aliasRows.map((row) => row.conceptId));
  const definitionRowsRaw = await db
    .select({
      id: conceptDefinitionVersions.id,
      conceptId: conceptDefinitionVersions.conceptId,
      definition: conceptDefinitionVersions.definition,
      confidence: conceptDefinitionVersions.confidence,
      team: conceptDefinitionVersions.team,
      product: conceptDefinitionVersions.product,
      region: conceptDefinitionVersions.region,
      process: conceptDefinitionVersions.process,
      role: conceptDefinitionVersions.role,
      validFrom: conceptDefinitionVersions.validFrom,
      validTo: conceptDefinitionVersions.validTo,
    })
    .from(conceptDefinitionVersions)
    .where(
      and(
        inArray(conceptDefinitionVersions.conceptId, conceptIds),
        eq(conceptDefinitionVersions.status, 'approved'),
      ),
    )
    .orderBy(
      desc(conceptDefinitionVersions.confidence),
      desc(conceptDefinitionVersions.validFrom),
    );

  const definitionRows = definitionRowsRaw as DefinitionRow[];

  const bestDefinitionByConcept = new Map<string, DefinitionRow>();
  for (const row of definitionRows) {
    if (!scopeMatches(row, contextScope)) continue;
    if (!temporalMatches(row.validFrom, row.validTo, effectiveAt)) continue;
    if (!bestDefinitionByConcept.has(row.conceptId)) {
      bestDefinitionByConcept.set(row.conceptId, row);
    }
  }

  const resolvedMap = new Map<string, ResolvedConcept>();
  for (const match of aliasRows) {
    const key = `${match.aliasNormalized}:${match.conceptId}`;
    if (resolvedMap.has(key)) continue;

    const definition = bestDefinitionByConcept.get(match.conceptId);
    resolvedMap.set(key, {
      conceptId: match.conceptId,
      conceptKey: match.conceptKey,
      conceptLabel: match.conceptLabel,
      alias: match.alias,
      aliasNormalized: match.aliasNormalized,
      definitionVersionId: definition?.id ?? null,
      definition: definition?.definition ?? null,
      confidence: definition?.confidence ?? match.confidence,
      criticality: match.criticality,
    });
  }

  const matchedTerms = new Set(aliasRows.map((row) => row.aliasNormalized));
  const unresolvedTerms = candidateTerms.filter((term) => !matchedTerms.has(term));

  return {
    resolved: [...resolvedMap.values()],
    matches: aliasRows,
    unresolvedTerms,
  };
}

function buildAmbiguities(
  resolved: ResolvedConcept[],
  policy: AmbiguityPolicy,
): AmbiguityPayload[] {
  const grouped = new Map<string, Set<string>>();
  for (const item of resolved) {
    const set = grouped.get(item.aliasNormalized) ?? new Set<string>();
    set.add(item.conceptKey);
    grouped.set(item.aliasNormalized, set);
  }

  const out: AmbiguityPayload[] = [];
  for (const [term, conceptsSet] of grouped.entries()) {
    const candidateConcepts = [...conceptsSet];
    if (candidateConcepts.length <= 1) continue;

    const reason = policy === 'strict'
      ? 'Ambiguous internal term detected under strict policy.'
      : 'Term maps to multiple concepts depending on scope/time.';

    out.push({ term, candidateConcepts, reason });
  }

  return out;
}

function buildInternalRewrite(
  query: string,
  resolved: ResolvedConcept[],
  contextScope: ContextScope | undefined,
  effectiveAt: Date,
): string {
  if (resolved.length === 0) {
    return query;
  }

  const lines: string[] = [];
  lines.push(query);
  lines.push('');
  lines.push('[INTERNAL_MEANING]');

  if (contextScope && Object.values(contextScope).some(Boolean)) {
    lines.push(`Scope: ${JSON.stringify(contextScope)}`);
  }

  lines.push(`EffectiveAt: ${effectiveAt.toISOString()}`);
  lines.push('Resolved concepts:');

  for (const concept of resolved) {
    const snippet = concept.definition
      ? `${concept.conceptKey}: ${concept.definition}`
      : `${concept.conceptKey}: (definition missing)`;
    lines.push(`- ${snippet}`);
  }

  return lines.join('\n');
}

async function expandGraphHints(
  resolved: ResolvedConcept[],
  contextScope: ContextScope | undefined,
  effectiveAt: Date,
): Promise<string[]> {
  if (resolved.length === 0) return [];

  const conceptIds = dedupe(resolved.map((item) => item.conceptId));
  const relationRowsRaw = await db
    .select({
      fromConceptId: conceptRelationships.fromConceptId,
      toConceptId: conceptRelationships.toConceptId,
      relationType: conceptRelationships.relationType,
      team: conceptRelationships.team,
      product: conceptRelationships.product,
      region: conceptRelationships.region,
      process: conceptRelationships.process,
      role: conceptRelationships.role,
      validFrom: conceptRelationships.validFrom,
      validTo: conceptRelationships.validTo,
    })
    .from(conceptRelationships)
    .where(
      and(
        inArray(conceptRelationships.fromConceptId, conceptIds),
        eq(conceptRelationships.status, 'approved'),
      ),
    );

  const relationRows = (relationRowsRaw as RelationRow[]).filter((row) => (
    scopeMatches(row, contextScope)
    && temporalMatches(row.validFrom, row.validTo, effectiveAt)
  ));

  if (relationRows.length === 0) return [];

  const allConceptIds = dedupe([
    ...relationRows.map((row) => row.fromConceptId),
    ...relationRows.map((row) => row.toConceptId),
  ]);

  const conceptRows = await db
    .select({
      id: concepts.id,
      key: concepts.key,
    })
    .from(concepts)
    .where(inArray(concepts.id, allConceptIds));

  const conceptKeyMap = new Map(conceptRows.map((row) => [row.id, row.key]));

  return relationRows.map((row) => {
    const fromKey = conceptKeyMap.get(row.fromConceptId) ?? row.fromConceptId;
    const toKey = conceptKeyMap.get(row.toConceptId) ?? row.toConceptId;
    return `${fromKey} ${row.relationType} ${toKey}`;
  });
}

function toInterpretationPayload(expandedQuery: string, resolved: ResolvedConcept[]) {
  return {
    detectedTerms: dedupe(resolved.map((item) => item.aliasNormalized)),
    resolvedConcepts: resolved.map((item) => ({
      conceptId: item.conceptId,
      conceptKey: item.conceptKey,
      alias: item.alias,
      definitionVersionId: item.definitionVersionId,
      confidence: item.confidence,
    })),
    definitionVersionIds: dedupe(
      resolved
        .map((item) => item.definitionVersionId)
        .filter((value): value is string => Boolean(value)),
    ),
    rewrittenQuery: expandedQuery,
  };
}

export async function runV2QueryFlow(input: QueryFlowInput): Promise<QueryFlowResult> {
  const start = performance.now();
  const contextScope = input.contextScope;
  const effectiveAt = parseEffectiveAt(input.effectiveAt);
  const ambiguityPolicy = input.ambiguityPolicy ?? 'show_both';

  let candidateTerms = makeCandidateTerms(input.query);
  let resolvedBundle = await resolveAliases(candidateTerms, contextScope, effectiveAt);

  if (resolvedBundle.resolved.length === 0 && input.rewriteEnabled) {
    const fallbackTerms = await classifyTermsWithLlm(input.query);
    if (fallbackTerms.length > 0) {
      candidateTerms = dedupe([...candidateTerms, ...fallbackTerms]);
      resolvedBundle = await resolveAliases(candidateTerms, contextScope, effectiveAt);
    }
  }

  const ambiguities = buildAmbiguities(resolvedBundle.resolved, ambiguityPolicy);
  const interpretationTimeMs = performance.now() - start;

  const strictFailureReasons: string[] = [];
  if (ambiguityPolicy === 'strict' && ambiguities.length > 0) {
    strictFailureReasons.push('Ambiguous internal terminology requires manual clarification.');
  }

  if (input.strictGrounding) {
    const criticalWithoutDefinition = resolvedBundle.resolved.filter((item) => (
      item.criticality === 'critical' && !item.definitionVersionId
    ));
    if (criticalWithoutDefinition.length > 0) {
      strictFailureReasons.push(
        `Missing approved definition for critical concepts: ${criticalWithoutDefinition.map((item) => item.conceptKey).join(', ')}`,
      );
    }
  }

  let expandedQuery = input.query;
  const graphStart = performance.now();
  if (input.graphEnabled) {
    const rewritten = buildInternalRewrite(input.query, resolvedBundle.resolved, contextScope, effectiveAt);
    const graphHints = await expandGraphHints(resolvedBundle.resolved, contextScope, effectiveAt);
    const graphSection = graphHints.length > 0
      ? `\n\n[GRAPH_RELATIONSHIPS]\n${graphHints.map((hint) => `- ${hint}`).join('\n')}`
      : '';
    expandedQuery = `${rewritten}${graphSection}`;
  }
  const graphExpansionTimeMs = performance.now() - graphStart;

  return {
    expandedQuery,
    interpretation: toInterpretationPayload(expandedQuery, resolvedBundle.resolved),
    ambiguities,
    unsupportedTerms: resolvedBundle.unresolvedTerms,
    strictFailureMessage: strictFailureReasons.length > 0
      ? [
        'Need verification workflow before answering this request.',
        ...strictFailureReasons.map((reason) => `- ${reason}`),
      ].join('\n')
      : null,
    stats: {
      interpretationTimeMs,
      graphExpansionTimeMs,
    },
  };
}

export const queryFlowTestUtils = {
  normalizeToken,
  makeCandidateTerms,
  scopeMatches,
  temporalMatches,
};
