import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import { ingestTestUtils } from '@/lib/rag-v2/ingest';

describe('rag-v2 ingest helpers', () => {
  it('extracts pattern terms from internal phrasing', () => {
    const text = 'V release board interně tomu říkáme "Green Status" pro schválené releasy.';
    const candidates = ingestTestUtils.extractPatternTerms(text);
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].termNormalized).toContain('green status');
  });

  it('deduplicates candidates by normalized term', () => {
    const deduped = ingestTestUtils.dedupeCandidates([
      {
        termOriginal: 'Green',
        termNormalized: 'green',
        context: 'a',
        confidence: 0.2,
      },
      {
        termOriginal: 'GREEN',
        termNormalized: 'green',
        context: 'b',
        confidence: 0.8,
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].confidence).toBe(0.8);
  });
});
