# 🕯️ NecroOps
### Local FinOps safety prototype with Kiro-oriented project assets

**Kiroween 2026 project · local fixture demonstration**

[![Local fixture checks](https://img.shields.io/badge/checks-run%20npm%20run%20ci-5b21b6.svg)](tests/)
[![License](https://img.shields.io/badge/license-MIT-success.svg)](LICENSE)

## Truthful scope

NecroOps is a **local, in-memory prototype**. It does **not** connect to an AWS account, call AWS APIs, read CloudWatch or Cost Explorer, create or deploy Lambda functions, execute a Kiro Crew, or terminate real cloud resources.

The server and dashboard operate on a finite fixture catalog. The identifiers, costs, risk values, generated code examples, workflow events, receipts, and state changes are **local demo-scenario data**. Do not describe them as production AWS observations, verified savings, deployed software, or live Kiro execution.

## What the prototype actually demonstrates

- a local modeled-cost and four-band risk scan across five fixture workloads, with thresholds at 80, 40, and 20;
- fixture-specific JavaScript examples for two supplied legacy-code fixtures;
- a seeded sample test plus an exhaustive integer-cent domain verification for all settleable amounts from $0.32 through $15,000;
- an in-memory simulated cleanup transition with sequential retry idempotency;
- an explicit reset that restores all five local fixtures to the initial demo scenario; and
- an unsigned SHA-256 digest over a canonical local-fixture receipt.

The initial local scenario totals **$1,050/month**. This is fixture data, not an AWS bill. The dashboard retrieves state from its own same-origin local API; it does not use timer-only success states.

## Local safety property

The local gate uses integer cents. For every integer-cent value from 32 cents through 1,500,000 cents (the full bounded settleable domain), the exhaustive gate checks:

1. the fixture’s legacy fee rule and local JavaScript example rule produce the same fee and net values; and
2. `net cents + fee cents = gross cents`.

Amounts that cannot cover the modeled fee are rejected. If this gate fails, the engine does not change the in-memory resource state or append a receipt.

This is a code-level property for a demo fixture—not approval to mutate cloud infrastructure.

## Reset the local demo scenario

The dashboard includes **Reset Local Fixture Scenario**. It sends `POST /api/reset` with the exact empty JSON object `{}` and restores the five local fixtures to the initial **88%** risk index and **$1,050/month** modeled total. Its `clearedTransitionCount` reports simulated state transitions reset, not persisted receipts: receipt contents are deliberately not stored in the browser session. Non-empty reset objects and invalid JSON shapes are rejected before any fixture state changes. The route does not reset, read, or change AWS, Kiro, or any external account.

For production and Vercel deployments, browser sessions are persisted in the Supabase `public.necroops_sessions` table. The server issues a fixed four-hour, `HttpOnly`, `SameSite=Lax`, `Secure` cookie containing only a session UUID, a database revision, and signed `issuedAt`/`expiresAt` timestamps. Fixture transition IDs are stored server-side, not trusted from the cookie. The HMAC signature is verified before the cookie is used; version-2 stateless cookies are not accepted by the production session flow.

Vercel communicates with the Supabase `necroops-session-gateway` Edge Function using an HMAC-signed request. The Edge Function verifies that signature through a restricted database function and uses its server-held Supabase service-role credential to call the session RPCs. The service-role credential is never placed in Vercel environment variables, GitHub, or browser code. The gateway HMAC key is stored as a Vercel sensitive environment variable and as a private database secret; the publishable key is only an API identifier and does not grant table/RPC access.

Every state-changing request uses an atomic database compare-and-swap against the cookie's revision. A stale signed cookie cannot restore an earlier snapshot: stale mutations receive HTTP `409 STALE_SESSION_COOKIE` or `409 SESSION_CONFLICT`, while a stale read returns the current database state and refreshes the cookie. Simultaneous mutations from the same session cannot both commit the same revision; one succeeds and competing writes receive HTTP `409`. The session lifetime is fixed at four hours and ordinary reads do not extend it. This is durable session state for the local simulator, not real AWS inventory or cloud remediation.

Local development without the Supabase gateway variables uses a process-local random signing key and the older stateless development fallback. That fallback is intentionally not distributed across processes and can replay an earlier local snapshot; it is not the production configuration. Local HTTP development remains usable without `Secure`, while forwarded HTTPS requests receive it.

### Production session configuration

Vercel Production and Preview require these server-side environment variables:

- `NECROOPS_LOCAL_FIXTURE_SESSION_SECRET`: private HMAC cookie-signing secret, at least 32 UTF-8 bytes.
- `NECROOPS_SUPABASE_URL`: Supabase project URL.
- `NECROOPS_SUPABASE_PUBLISHABLE_KEY`: Supabase publishable API key, used only as the Edge Function API identifier.
- `NECROOPS_SUPABASE_GATEWAY_SECRET`: sensitive 48-byte hex HMAC key shared with the private database verifier.

Generate independent secrets locally, for example:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Do not commit or publish either secret. The production Vercel handler fails closed if the Supabase gateway configuration is missing. The Supabase service-role key remains inside the Edge Function runtime.

## Kiro-oriented project assets

```text
.kiro/
├── agents/       # three illustrative role manifests
├── hooks/        # two illustrative hook definitions
├── powers/       # unattached least-privilege manifest
├── specs/        # local-fixture requirements
└── steering/     # reference safety guidance
```

The test suite checks these project assets are present at the documented root paths. Their presence is **not proof** that Kiro, a hook, an agent, or a power ran. Each asset carries an explicit local/illustrative boundary.

## Run locally

**Supported Node.js:** 20 or newer. The project has no runtime npm dependencies, but commits a lockfile so clean installs are reproducible.

```bash
npm ci --ignore-scripts
npm run ci
npm start
```

Open `http://localhost:3000`. The page begins with **LOCAL DEMO FIXTURES — NO AWS ACCOUNT CONNECTED**.

The standalone gate can also be run directly:

```bash
npm run test:gate
```

It returns a nonzero exit code if the local gate fails. The `.kiro/hooks/pre-purge-hook.json` file references this command as an **illustrative, unverified** hook action; the local Node server does not load or execute Kiro hooks.

## Test coverage

`npm run ci` runs the Node suite plus the standalone exhaustive integer-cent-domain gate. The seeded 100-trial method remains available as supplementary deterministic testing, not as the cleanup gate. The suite covers:

- immutable scan snapshots and explicit cleanup ordering;
- fixture-specific code examples;
- integer-cent math, exhaustive domain verification, boundary cases, reproducible seeded samples, and forced-gate-failure atomicity;
- receipt digest recomputation and tamper detection;
- root `.kiro` asset paths and their runtime-boundary metadata;
- dashboard source using same-origin API calls and its explicit reset control; and
- isolated HTTP handling for success, malformed input, oversized bodies, missing routes, explicit mutation targets, exact-empty-object local reset, and no permissive CORS header; and
- all four risk-status bands plus signed-cookie tampering, temporal expiry, legacy-version fallback, database-backed stale-cookie rejection, atomic concurrent mutation conflicts, and production/Vercel `Secure` cookie behavior.

GitHub Actions is configured for Node 20 and 22. Read the actual workflow result rather than relying on a static badge.

## Public audit artifact

After each source remediation, regenerate and publish the audit record with:

```bash
npm run audit:refresh
npm run audit:verify
```

The artifact path is:

```text
docs/audit/necroops-fixture-mode-audit-log.json
```

**Baseline release audit artifact SHA-256:** `9fb2212ee64a1edd546472351ee21d29913f65827232d5d8d62d5f0abf90b975` (this hash belongs to the pinned baseline release, not this remediation branch; regenerate the audit artifact and digest before merging).

The inventory covers every version-controlled, non-ignored project file except the audit artifact itself (a file cannot include its own raw hash). To avoid a hash self-reference, the two documentation lines that repeat this artifact digest are normalized to a fixed token before their inventory hashes are calculated. `npm run audit:verify` checks the complete inventory, that normalization rule, and that the visible digest lines match the artifact bytes. The artifact's `generationBaseCommit` records the checked-out generator context before the publication commit; the normalized inventory, not that pre-commit field, identifies the audited tree. Historical audits remain historical; they are not evidence for a later source revision.

## Before any live claim

A real integration must use a separately approved non-production AWS account, least-privilege credentials kept outside this repository, explicit human approval, and retained runtime evidence. Do not claim AWS reads/remediation, Kiro Crew/CLI/Web execution, Kiro-hook execution, or bonus eligibility until each is independently proven.

## License

[MIT](LICENSE)
