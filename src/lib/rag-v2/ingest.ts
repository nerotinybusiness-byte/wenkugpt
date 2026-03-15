import { db } from '@/lib/db';
import { termCandidates } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

export interface SlangSourceMetadata {
  sourceType: string;
  documentId?: string | null;
  author?: string | null;
  team?: string | null;
  product?: string | null;
  region?: string | null;
  process?: string | null;
  role?: string | null;
}

export interface TermCandidateInput {
  termOriginal: string;
  termNormalized: string;
  context: string;
  confidence: number;
}

function normalizeTerm(term: string): string {
  return term
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s_:-]/gu, ' ')
    .replace(/\s+/g, ' ');
}

function extractPatternTerms(text: string): TermCandidateInput[] {
  const candidates: TermCandidateInput[] = [];
  const normalizedText = text.replace(/\r/g, '');
  const lines = normalizedText.split('\n');

  const patterns = [
    /(?:říkáme tomu|interně tomu říkáme)\s+["“]?([^"\n”]{2,80})["”]?/i,
    /(?:aka|a\.k\.a\.|=)\s+([A-Za-z0-9_\- :]{2,80})/i,
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = pattern.exec(line);
      if (!match) continue;
      const termOriginal = match[1].trim();
      const termNormalized = normalizeTerm(termOriginal);
      if (!termNormalized) continue;

      candidates.push({
        termOriginal,
        termNormalized,
        context: line.trim().slice(0, 500),
        confidence: 0.65,
      });
    }
  }

  return candidates;
}

function extractNgramTerms(text: string): TermCandidateInput[] {
  const normalized = normalizeTerm(text);
  const words = normalized.split(' ').filter((w) => w.length >= 3 && w.length <= 30);

  const counts = new Map<string, number>();
  for (let i = 0; i < words.length; i += 1) {
    const one = words[i];
    counts.set(one, (counts.get(one) ?? 0) + 1);
    if (i + 1 < words.length) {
      const two = `${words[i]} ${words[i + 1]}`;
      counts.set(two, (counts.get(two) ?? 0) + 1);
    }
  }

  const out: TermCandidateInput[] = [];
  for (const [termNormalized, count] of counts.entries()) {
    if (count < 3) continue;
    out.push({
      termOriginal: termNormalized,
      termNormalized,
      context: '',
      confidence: Math.min(0.6, 0.2 + count * 0.05),
    });
  }

  return out.slice(0, 100);
}

function dedupeCandidates(candidates: TermCandidateInput[]): TermCandidateInput[] {
  const map = new Map<string, TermCandidateInput>();
  for (const candidate of candidates) {
    const existing = map.get(candidate.termNormalized);
    if (!existing) {
      map.set(candidate.termNormalized, candidate);
      continue;
    }

    map.set(candidate.termNormalized, {
      ...existing,
      confidence: Math.max(existing.confidence, candidate.confidence),
      context: existing.context || candidate.context,
    });
  }
  return [...map.values()];
}

export async function ingestSlangCandidates(
  text: string,
  metadata: SlangSourceMetadata,
): Promise<number> {
  const candidates = dedupeCandidates([
    ...extractPatternTerms(text),
    ...extractNgramTerms(text),
  ]);

  if (candidates.length === 0) return 0;

  let inserted = 0;
  for (const candidate of candidates) {
    const existing = await db
      .select({ id: termCandidates.id, frequency: termCandidates.frequency })
      .from(termCandidates)
      .where(and(
        eq(termCandidates.termNormalized, candidate.termNormalized),
        metadata.documentId
          ? eq(termCandidates.documentId, metadata.documentId)
          : isNull(termCandidates.documentId),
      ))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(termCandidates)
        .set({
          frequency: (existing[0].frequency ?? 0) + 1,
          confidence: Math.max(candidate.confidence, 0.3),
          updatedAt: new Date(),
        })
        .where(eq(termCandidates.id, existing[0].id));
      continue;
    }

    await db.insert(termCandidates).values({
      termOriginal: candidate.termOriginal,
      termNormalized: candidate.termNormalized,
      contexts: candidate.context ? [candidate.context] : [],
      frequency: 1,
      sourceType: metadata.sourceType,
      documentId: metadata.documentId ?? null,
      author: metadata.author ?? null,
      team: metadata.team ?? null,
      product: metadata.product ?? null,
      region: metadata.region ?? null,
      process: metadata.process ?? null,
      role: metadata.role ?? null,
      confidence: candidate.confidence,
      status: 'pending',
    });
    inserted += 1;
  }

  return inserted;
}

export const ingestTestUtils = {
  normalizeTerm,
  extractPatternTerms,
  extractNgramTerms,
  dedupeCandidates,
};
