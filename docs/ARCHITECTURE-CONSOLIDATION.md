# Architecture Consolidation — v0.13

v0.13 is an architecture-consolidation release. It does not add role-specific UI or a new data model.

## Canonical flow

raw data → domain facts → semantic state → human reading → application selectors/actions → UI

## Boundaries

1. Domain owns what an exam, score, ranking, comparison and share mean.
2. Application owns state transitions, actions and selectors.
3. UI renders view models and dispatches actions; it does not invent business rules.
4. Repository/API owns persistence and transport; UI does not know KV keys.
5. Share projection is a restricted view of the same domain facts.

## Migration policy

- `public/domain-v001.js` is the canonical client-domain facade during migration.
- Existing versioned implementation files remain compatibility implementations; new semantic logic must not be added as another versioned helper.
- `app.js` is an application shell, not a new location for domain rules.
- Student/parent/teacher are review perspectives only, never runtime roles.
- Data Schema 1, Workers KV and Share v2 remain unchanged.

## v0.13 acceptance criteria

- Score-first reading and comparison use the same metric.
- Pages consume the canonical domain facade instead of importing semantic helpers independently.
- Legacy semantic modules are compatibility implementations, not extension points.
- Architecture boundaries are protected by tests.
- Migration is incremental and does not change stored data or public links.
