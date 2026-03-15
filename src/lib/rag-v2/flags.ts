function readBooleanFlag(name: string, defaultValue = false): boolean {
  const rawValue = process.env[name];
  if (rawValue === undefined) return defaultValue;

  const normalized = rawValue.trim().toLowerCase();
  return normalized === '1'
    || normalized === 'true'
    || normalized === 'yes'
    || normalized === 'on';
}

export interface RAGV2Flags {
  graphEnabled: boolean;
  rewriteEnabled: boolean;
  strictGrounding: boolean;
}

export function getRagV2Flags(): RAGV2Flags {
  return {
    graphEnabled: readBooleanFlag('RAG_V2_GRAPH_ENABLED', false),
    rewriteEnabled: readBooleanFlag('RAG_V2_REWRITE_ENABLED', false),
    strictGrounding: readBooleanFlag('RAG_V2_STRICT_GROUNDING', false),
  };
}

export function isRagV2KillSwitchEnabled(): boolean {
  return readBooleanFlag('RAG_V2_KILL_SWITCH', false);
}
