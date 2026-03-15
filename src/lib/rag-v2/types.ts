export type AmbiguityPolicy = 'ask' | 'show_both' | 'strict';

export interface ContextScope {
  team?: string;
  product?: string;
  region?: string;
  process?: string;
  role?: string;
}

export interface ResolvedConcept {
  conceptId: string;
  conceptKey: string;
  conceptLabel: string;
  alias: string;
  aliasNormalized: string;
  definitionVersionId: string | null;
  definition: string | null;
  confidence: number;
  criticality: 'normal' | 'critical';
}

export interface InterpretationPayload {
  detectedTerms: string[];
  resolvedConcepts: Array<{
    conceptId: string;
    conceptKey: string;
    alias: string;
    definitionVersionId: string | null;
    confidence: number;
  }>;
  definitionVersionIds: string[];
  rewrittenQuery?: string;
}

export interface AmbiguityPayload {
  term: string;
  candidateConcepts: string[];
  reason: string;
}

export interface QueryFlowResult {
  expandedQuery: string;
  interpretation: InterpretationPayload;
  ambiguities: AmbiguityPayload[];
  unsupportedTerms: string[];
  strictFailureMessage: string | null;
  stats: {
    interpretationTimeMs: number;
    graphExpansionTimeMs: number;
  };
}
