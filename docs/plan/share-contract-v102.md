# Share Contract Recovery — v0.10.2

## Objective

Make the implemented Share v2 contract the only runtime contract for share creation, external reading and authenticated preview.

## Contract

- `scope`: `single` or `trajectory`
- `mode`: `live` or `snapshot`
- `single` scope carries explicit `examId`
- trajectory live with one existing exam requires explicit acknowledgement that later exams will join the link
- external and authenticated preview use the same allow-list projection
- Share list/revoke remain compatible with existing KV grant/index records

## Changes

1. Route public reads through `src/sharing-v2.js`.
2. Route private creation and preview through `src/sharing-v2.js`.
3. Remove obsolete share creation/external-read implementations from `src/index.js`.
4. Keep Schema 1 and existing KV key structures; no data migration.
5. Add Worker integration coverage for selected-exam pinning, preview, live trajectory, snapshot freeze, subsequent exams, revoke and acknowledgement.
6. Bump application version from `0.10.0` to `0.10.2`.

## Release Gate

- `npm ci`
- `npm run verify`
- exact PR-head CI green
- merge with exact PR head
- main CI green
- Cloudflare deployment checks out the exact tested SHA
- production `/api/health` reports `appVersion=0.10.2`, `buildSha=<main sha>`, `schemaVersion=1`, `storage=workers-kv`

## Rollback

Revert the v0.10.2 PR. No KV migration is introduced.
