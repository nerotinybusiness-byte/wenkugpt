# RAG v2 Query Flow

## Stage A: Term Detection
- build candidate terms from query tokens (1-3 grams)
- attempt alias resolution via `concept_aliases`
- optional fallback classifier if rewrite flag is enabled

## Stage B: Internal Meaning Rewrite
- produce rewritten internal query with:
  - resolved concepts
  - scoped context
  - effective timestamp

## Stage C: Graph Expansion
- load approved, active relationships for resolved concepts
- append graph hints (implies/requires/opposes/contradicts)

## Stage D: Evidence Retrieval
- pass expanded query into existing hybrid retrieval pipeline

## Stage E: Grounded Output Contract
- provide optional response metadata:
  - `interpretation`
  - `ambiguities`
  - `engineMeta`

## Fail-safe Rules
- strict ambiguity policy can fail closed
- strict grounding can block response if critical concept lacks approved definition
