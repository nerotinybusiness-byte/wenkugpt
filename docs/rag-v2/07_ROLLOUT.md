# RAG v2 Rollout

## Phase 0: Dev-only
- `v1` default
- `v2` selectable but guarded by flags
- graph/rewrite/strict flags default off

## Phase 1: Shadow
- run interpretation and telemetry
- keep user-visible behavior conservative

## Phase 2: Limited Operator Rollout
- expose `v2` to selected admin users
- monitor ambiguity and unsupported-term metrics

## Phase 3: Broad Rollout
- widen enablement only if stability targets hold

## Data Refresh Step (for PDF precision remediation)
- after deploying ingest/viewer precision fixes:
  1. clear or archive legacy documents with coarse bbox metadata
  2. reupload/reingest target PDF corpus
  3. run citation precision smoke checks before declaring closure

## Rollback Controls
- `RAG_V2_KILL_SWITCH=true` forces server fallback to `v1`
- client toggle can remain visible while backend enforces fallback

## Promotion Criteria
1. no critical regression vs `v1`
2. stable latency envelope
3. better handling of internal term ambiguity
