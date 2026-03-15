import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getRagV2Flags, isRagV2KillSwitchEnabled } from '@/lib/rag-v2/flags';

describe('isRagV2KillSwitchEnabled', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns false when env var is not set', () => {
    delete process.env.RAG_V2_KILL_SWITCH;
    expect(isRagV2KillSwitchEnabled()).toBe(false);
  });

  it.each(['1', 'true', 'yes', 'on', 'TRUE', 'YES', 'ON'])(
    'returns true for truthy value "%s"',
    (value) => {
      process.env.RAG_V2_KILL_SWITCH = value;
      expect(isRagV2KillSwitchEnabled()).toBe(true);
    },
  );

  it.each(['false', '0', '', 'no', 'off', 'FALSE', 'OFF'])(
    'returns false for falsy value "%s"',
    (value) => {
      process.env.RAG_V2_KILL_SWITCH = value;
      expect(isRagV2KillSwitchEnabled()).toBe(false);
    },
  );
});

describe('getRagV2Flags', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.RAG_V2_GRAPH_ENABLED;
    delete process.env.RAG_V2_REWRITE_ENABLED;
    delete process.env.RAG_V2_STRICT_GROUNDING;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns all false when env vars are not set', () => {
    expect(getRagV2Flags()).toEqual({
      graphEnabled: false,
      rewriteEnabled: false,
      strictGrounding: false,
    });
  });

  it('reads individual flags independently', () => {
    process.env.RAG_V2_GRAPH_ENABLED = '1';
    process.env.RAG_V2_STRICT_GROUNDING = 'true';
    const flags = getRagV2Flags();
    expect(flags.graphEnabled).toBe(true);
    expect(flags.rewriteEnabled).toBe(false);
    expect(flags.strictGrounding).toBe(true);
  });
});
