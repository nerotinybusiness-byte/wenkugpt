export type ChatErrorCode =
  | 'CHAT_UPSTREAM_TRANSIENT'
  | 'CHAT_DB_TRANSIENT'
  | 'CHAT_UNEXPECTED';

export type ChatErrorStage = 'upstream' | 'database' | 'unknown';

export interface ChatErrorClassification {
  code: ChatErrorCode;
  retryable: boolean;
  httpStatus: 503 | 500;
  userMessageCs: string;
  stage: ChatErrorStage;
}

const DEFAULT_MESSAGE_CS = 'Dočasný výpadek odpovědi. Zkus to prosím znovu.';

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`.toLowerCase();
  return String(error ?? '').toLowerCase();
}

export function classifyChatError(error: unknown): ChatErrorClassification {
  const message = normalizeErrorMessage(error);

  const isUpstreamTransient = (
    message.includes('llm call timed out')
    || message.includes('etimedout')
    || message.includes('econnreset')
    || message.includes('status code 429')
    || message.includes(' too many requests')
    || message.includes('status: 429')
    || message.includes('status 429')
    || message.includes('status code 500')
    || message.includes('status code 502')
    || message.includes('status code 503')
    || message.includes('status code 504')
    || message.includes('status: 500')
    || message.includes('status: 502')
    || message.includes('status: 503')
    || message.includes('status: 504')
  );

  if (isUpstreamTransient) {
    return {
      code: 'CHAT_UPSTREAM_TRANSIENT',
      retryable: true,
      httpStatus: 503,
      userMessageCs: DEFAULT_MESSAGE_CS,
      stage: 'upstream',
    };
  }

  const isDbTransient = (
    message.includes('connection terminated')
    || message.includes('connection timeout')
    || message.includes('connection timed out')
    || message.includes('timeout expired')
    || message.includes('remaining connection slots are reserved')
    || message.includes('sorry, too many clients already')
    || message.includes('db')
    || message.includes('pool')
  );

  if (isDbTransient) {
    return {
      code: 'CHAT_DB_TRANSIENT',
      retryable: true,
      httpStatus: 503,
      userMessageCs: DEFAULT_MESSAGE_CS,
      stage: 'database',
    };
  }

  return {
    code: 'CHAT_UNEXPECTED',
    retryable: false,
    httpStatus: 500,
    userMessageCs: DEFAULT_MESSAGE_CS,
    stage: 'unknown',
  };
}
