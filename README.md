# 🕯️ NecroOps
### Local FinOps safety prototype with Kiro-oriented project assets

**Kiroween 2026 project · local fixture demonstration**

[![Local fixture checks](https://img.shields.io/badge/checks-run%20npm%20run%20ci-5b21b6.svg)](tests/)
[![License](https://img.shields.io/badge/license-MIT-success.svg)](LICENSE)

## Truthful scope

NecroOps is a **local, in-memory prototype**. It does **not** connect to an AWS account, call AWS APIs, read CloudWatch or Cost Explorer, create or deploy Lambda functions, execute a Kiro Crew, or terminate real cloud resources.

The server and dashboard operate on a finite fixture catalog. The identifiers, costs, risk values, generated code examples, workflow events, receipts, and state changes are **local demo-scenario data**. Do not describe them as production AWS observations, verified savings, deployed software, or live Kiro execution.

## What the prototype actually demonstrates

- a local modeled-cost and risk scan across five fixture workloads;
- fixture-specific JavaScript examples for two supplied legacy-code fixtures;
- a deterministic, seeded 100-trial local numerical property gate;
- an in-memory, idempotent simulated cleanup transition;
- an explicit reset that restores all five local fixtures to the initial demo scenario; and
- an unsigned SHA-256 digest over a canonical local-fixture receipt.

The initial local scenario totals **$1,050/month**. This is fixture data, not an AWS bill. The dashboard retrieves state from its own same-origin local API; it does not use timer-only success states.

## Local safety property

The local gate uses integer cents. For 100 seeded fixture values that can cover the modeled fixed fee, it checks:

1. the fixture’s legacy fee rule and local JavaScript example rule produce the same fee and net values; and
2. `net cents + fee cents = gross cents`.

Amounts that cannot cover the modeled fee are rejected. If this gate fails, the engine does not change the in-memory resource state or append a receipt.

This is a code-level property for a demo fixture—not approval to mutate cloud infrastructure.

## Reset the local demo scenario

The dashboard includes **Reset Local Fixture Scenario**. It sends `POST /api/reset` with an empty JSON object and restores the five local fixtures to the initial **88%** risk index and **$1,050/month** modeled total. It does not reset, read, or change AWS, Kiro, or any external account.

For deterministic Vercel behavior, the server stores only the IDs of simulated local transitions in a four-hour, `HttpOnly`, `SameSite=Lax` browser-session cookie and reconstructs the fixture engine on each API request. The cookie contains no receipt, fixture content, credential, cloud-account data, or external-resource identifier. Clearing/expiring it returns the browser to the default local scenario; it is not cloud persistence.

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

`npm run ci` runs the Node suite plus the standalone 100-trial gate. The suite covers:

- immutable scan snapshots and explicit cleanup ordering;
- fixture-specific code examples;
- integer-cent math, boundary cases, reproducible seeds, and forced-gate-failure atomicity;
- receipt digest recomputation and tamper detection;
- root `.kiro` asset paths and their runtime-boundary metadata;
- dashboard source using same-origin API calls and its explicit reset control; and
- isolated HTTP handling for success, malformed input, oversized bodies, missing routes, explicit mutation targets, local reset, and no permissive CORS header.

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

**Complete audit artifact SHA-256:** `2891c5beadbaede7a4e5a524f89e4ed86b279995d3a7215159b3a7580897ab6d`

The inventory covers every version-controlled, non-ignored project file except the audit artifact itself (a file cannot include its own raw hash). To avoid a hash self-reference, the three documentation lines that repeat this artifact digest are normalized to a fixed token before their inventory hashes are calculated. `npm run audit:verify` checks the complete inventory, that normalization rule, and that the visible digest lines match the artifact bytes. Historical audits remain historical; they are not evidence for a later source revision.

## Before any live claim

A real integration must use a separately approved non-production AWS account, least-privilege credentials kept outside this repository, explicit human approval, and retained runtime evidence. Do not claim AWS reads/remediation, Kiro Crew/CLI/Web execution, Kiro-hook execution, or bonus eligibility until each is independently proven.

## License

[MIT](LICENSE)
