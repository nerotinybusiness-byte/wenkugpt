import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import { queryFlowTestUtils } from '@/lib/rag-v2/query-flow';

describe('rag-v2 query-flow helpers', () => {
  it('normalizes tokens and builds n-gram candidates', () => {
    const terms = queryFlowTestUtils.makeCandidateTerms('Je to GREEN status pro release gate?');
    expect(terms).toContain('green');
    expect(terms).toContain('release gate');
    expect(terms).toContain('green status');
  });

  it('matches scope when context is compatible', () => {
    const result = queryFlowTestUtils.scopeMatches(
      {
        team: 'compliance',
        product: null,
        region: null,
        process: null,
        role: null,
      },
      { team: 'compliance' },
    );
    expect(result).toBe(true);
  });

  it('rejects out-of-range temporal window', () => {
    const validFrom = new Date('2026-01-01T00:00:00.000Z');
    const validTo = new Date('2026-02-01T00:00:00.000Z');
    const effectiveAt = new Date('2026-03-01T00:00:00.000Z');
    expect(queryFlowTestUtils.temporalMatches(validFrom, validTo, effectiveAt)).toBe(false);
  });
});
