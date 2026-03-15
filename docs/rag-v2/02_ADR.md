# RAG v2 ADR

## ADR-001: Graph Store Strategy
- Date: 2026-02-10
- Decision: Postgres-first graph memory (`Drizzle + PostgreSQL`)
- Why:
  - reuse current production stack
  - lower rollout risk than introducing Neo4j in phase 1
  - simpler operational ownership
- Consequence:
  - graph query flexibility is lower than dedicated graph DB
  - explicit indexing and query tuning required

## ADR-002: Rollout Strategy
- Date: 2026-02-10
- Decision: staged rollout with `v1` default and `v2` feature-flag gates
- Why:
  - immediate rollback path via `RAG_V2_KILL_SWITCH`
  - protects production UX while v2 semantics mature
- Consequence:
  - temporary dual-path maintenance overhead

## ADR-003: Logging Policy
- Date: 2026-02-10
- Decision: append-only execution log + ADR updates for major changes
- Why:
  - context continuity across sessions
  - auditability of architecture decisions
