# RAG v2 Data Model

## Core Tables
1. `concepts`
- canonical concept identity (`key`, `label`)
- governance (`status`, `criticality`, `defined_by`, `approved_by`)

2. `concept_aliases`
- surface terms -> canonical concept
- scope dimensions (`team`, `product`, `region`, `process`, `role`)
- temporal validity (`valid_from`, `valid_to`)

3. `concept_definition_versions`
- versioned meanings (`version`, `definition`)
- scope + temporal validity
- approval state and confidence

4. `concept_relationships`
- directed graph edges (`implies`, `requires`, `opposes`, `contradicts`, `similar_to`)
- scoped and temporal

5. `concept_evidence`
- traceable evidence linked to concept/definition/alias/document

6. `term_candidates`
- mined candidate terms from ingestion
- review status and confidence

7. `definition_reviews`
- human-in-the-loop decisions over candidates/definitions

## Invariants
- concept key is globally unique
- alias uniqueness is constrained by normalized alias + scope + validity start
- definition version unique per concept (`concept_id`, `version`)
- relationship uniqueness constrained by endpoints + type + scope + validity start
- candidates are unique per normalized term + document
