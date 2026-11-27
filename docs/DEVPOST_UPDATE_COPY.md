# NecroOps — publication and audit status

This file supersedes the historical Devpost update instructions. The public Devpost project has already been updated and published; do not apply the obsolete placeholder-video or stateless-cookie instructions from earlier drafts.

- **Published project:** https://devpost.com/software/necroops-8x6e1l
- **Live app:** https://necro-ops.vercel.app/
- **Source:** https://github.com/Devv66/Necro-ops
- **Demo:** https://www.youtube.com/watch?v=WhHkVcL07OM

## Current technical boundary

NecroOps is a local fixture FinOps prototype. It does not connect to AWS or perform real cloud cleanup. Production browser-session persistence is implemented through a Supabase session gateway with atomic database compare-and-swap. Automated tests exercise stale-cookie, concurrency, expiry, and adapter error-handling behavior using deterministic in-memory stores and mocked gateway responses; they do not constitute a live Supabase data-plane verification.

## Audit

The source-controlled audit record is `docs/audit/necroops-fixture-mode-audit-log.json`. Its generator is `npm run audit:refresh`, and its integrity check is `npm run audit:verify`.

**Complete audit artifact SHA-256:** `34203210fa1a5a9727ec24d7c2b4eb7d7a5e6a545193168c126a2c1d643ac153`

The digest is updated by the audit generator. Verify the published source revision with `npm run ci` and `npm run audit:verify`.

## Scope exclusions

AWS account integration and real cloud actions remain intentionally out of scope. Kiro-oriented manifests are project assets; their presence is not evidence of live Kiro runtime execution.
