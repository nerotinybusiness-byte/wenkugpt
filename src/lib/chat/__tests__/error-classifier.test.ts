import { describe, expect, it } from 'vitest';
import { classifyChatError } from '@/lib/chat/error-classifier';

describe('classifyChatError', () => {
  describe('CHAT_UPSTREAM_TRANSIENT', () => {
    it.each([
      'LLM call timed out after 30s',
      'ETIMEDOUT connecting to Gemini',
      'ECONNRESET',
      'Request failed with status code 429',
      'Too many requests',
      'Request failed with status: 429',
      'status 429',
      'status code 500',
      'status code 502',
      'status code 503',
      'status code 504',
      'status: 500',
      'status: 502',
      'status: 503',
      'status: 504',
    ])('classifies "%s" as upstream transient', (msg) => {
      const result = classifyChatError(new Error(msg));
      expect(result.code).toBe('CHAT_UPSTREAM_TRANSIENT');
      expect(result.retryable).toBe(true);
      expect(result.httpStatus).toBe(503);
      expect(result.stage).toBe('upstream');
    });
  });

  describe('CHAT_DB_TRANSIENT', () => {
    it.each([
      'connection terminated unexpectedly',
      'connection timeout after 5000ms',
      'connection timed out',
      'timeout expired waiting for pool',
      'remaining connection slots are reserved for replication',
      'sorry, too many clients already',
    ])('classifies "%s" as db transient', (msg) => {
      const result = classifyChatError(new Error(msg));
      expect(result.code).toBe('CHAT_DB_TRANSIENT');
      expect(result.retryable).toBe(true);
      expect(result.httpStatus).toBe(503);
      expect(result.stage).toBe('database');
    });
  });

  describe('CHAT_UNEXPECTED — must NOT match on substring "db" or "pool"', () => {
    it.each([
      'undefined variable in debug context',
      'Cannot read properties of undefined',
      'Adobe PDF parsing error',
      'thread pooling strategy failed',
      'threadpool exhausted',
      'jdbcPool connection refused',
      'dbConfig is missing',
      'debug info: missing key',
    ])('classifies "%s" as unexpected (not db transient)', (msg) => {
      const result = classifyChatError(new Error(msg));
      expect(result.code).toBe('CHAT_UNEXPECTED');
      expect(result.retryable).toBe(false);
      expect(result.httpStatus).toBe(500);
      expect(result.stage).toBe('unknown');
    });
  });

  describe('CHAT_UNEXPECTED', () => {
    it('classifies unknown error as unexpected', () => {
      const result = classifyChatError(new Error('some random application error'));
      expect(result.code).toBe('CHAT_UNEXPECTED');
      expect(result.retryable).toBe(false);
      expect(result.httpStatus).toBe(500);
    });

    it('handles non-Error values', () => {
      const result = classifyChatError('plain string error');
      expect(result.code).toBe('CHAT_UNEXPECTED');
    });

    it('handles null/undefined', () => {
      expect(classifyChatError(null).code).toBe('CHAT_UNEXPECTED');
      expect(classifyChatError(undefined).code).toBe('CHAT_UNEXPECTED');
    });
  });
});
