# NecroOps — truthful Devpost Story replacement

> Use this as the complete Story replacement after the public repository contains the matching source revision and audit artifact. Do not submit until the public URLs and final audit digest are checked.

## Tagline

A local, fixture-based FinOps safety prototype that models zombie-workload triage and gates simulated cleanup with reproducible property checks.

## The problem

Cloud cleanup is risky when a workload looks idle but still hides dependencies, legacy business rules, or financial edge cases. Deleting a resource based on a guess is unsafe; leaving it untouched can be expensive.

NecroOps explores an evidence-first local prototype: select a modeled fixture, prepare a fixture-specific code example where supplied code exists, run a local numerical property gate, and record an auditable in-memory state transition.

## What NecroOps does

NecroOps is a **local demonstration prototype**. Its standalone Node server uses a finite, in-memory fixture catalog. It does **not** connect to an AWS account, call AWS APIs, scan CloudWatch or Cost Explorer, deploy Lambda functions, execute Kiro Crew, or terminate real infrastructure.

Within that local scenario, it:

1. totals modeled monthly cost and risk values for five fixture workloads;
2. prepares different JavaScript examples for the supplied payment-worker and billing-webhook fixtures;
3. runs 100 seeded integer-cent property trials before allowing a simulated cleanup path;
4. rejects malformed requests, omitted mutation target IDs, and invalid fixture values;
5. changes only in-memory fixture state after the gate passes;
6. provides a clearly labelled **Reset Local Fixture Scenario** control that restores all five local fixtures to their initial 88% risk and $1,050/month modeled state; and
7. creates an **unsigned local-fixture receipt** with a SHA-256 digest covering one captured timestamp, target, modeled amount, reason, and gate summary.

The initial fixture catalog models **$1,050/month**. Any dashboard cost or risk change is demo-scenario output only—not a verified AWS saving, resource state, or cloud remediation.

## The local safety property

For each accepted fixture amount, the local gate checks:

```text
local legacy fee rule equals local example fee rule
and
net cents + fee cents = gross cents
```

The checks use integer cents, a recorded deterministic seed, and 100 trials. Amounts that cannot cover the modeled fee are rejected. Tests include an injected gate failure and verify that it leaves both the fixture resource state and receipt log unchanged.

This is a code-level safety property for the local simulator. It is not evidence of a live AWS termination or production financial validation.

## Dashboard and HTTP boundary

The dashboard loads the ledger and metrics from the simulator’s same-origin API and sends an explicit fixture target for its local workflow call. Its clearly labelled **Reset Local Fixture Scenario** button calls `POST /api/reset` and restores the five fixture records to the initial local state. To make this browser demo deterministic across Vercel function instances, the server reconstructs the local engine from a four-hour `HttpOnly`, `SameSite=Lax` cookie that contains only validated IDs of simulated local transitions. It contains no receipt, fixture payload, credential, AWS account data, or external-resource state. It renders returned receipt data and errors instead of showing timer-only success. The server applies a JSON body limit, validates mutation input, uses explicit API 4xx responses, returns API 404s as JSON, and does not enable permissive cross-origin access.

## Kiro-oriented assets and spec-driven work

The public repository includes structured project assets:

- `.kiro/agents/` — three illustrative role manifests: Reaper, Necromancer, and Exorcist;
- `.kiro/hooks/` — illustrative pre-purge and post-resurrection definitions;
- `.kiro/specs/necroops-spec.json` — local-fixture requirements and safety invariants;
- `.kiro/steering/agent-guidelines.md` — reference safety and truthfulness guidance; and
- `.kiro/powers/aws-exorcist-power.json` — an unattached least-privilege manifest for a future approved test integration.

The automated suite verifies these files exist at the expected paths and state their runtime boundary. This submission does **not** claim that the audit executed a Kiro Crew session, Kiro CLI workflow, Kiro Web review, AWS request, power, or hook in a Kiro runtime.

## Verification

Run the public source with Node 20 or newer:

```bash
npm ci --ignore-scripts
npm run ci
```

The source also includes a Node 20/22 GitHub Actions workflow. Use the actual workflow result, not a hard-coded badge.

The current public audit artifact is:

```text
docs/audit/necroops-fixture-mode-audit-log.json
```

**Complete audit artifact SHA-256:** `996d8533ea606bb7d7a72a794f426e57fa4bac487ebd21cc83f0af0897f0e234`

This digest is refreshed from the exact source revision by `npm run audit:refresh`. The complete inventory includes `api/index.js` and `vercel.json`, and `npm run audit:verify` checks it before submission.

Verify it with:

```bash
sha256sum docs/audit/necroops-fixture-mode-audit-log.json
```

Do not use the historical digest `8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4`.

## What we learned

For destructive infrastructure workflows, a polished simulation is not the same as evidence from a real cloud account. NecroOps keeps that boundary visible: its catalog is local fixture data; live actions require separate authenticated access, least-privilege review, explicit approval, and captured runtime evidence.

## What is next

- Connect a separately approved test AWS account using credentials kept outside the repository.
- Capture real read-only inventory evidence before making live scan claims.
- Add a human approval and dry-run process before any real remediation action.
- Run and capture Kiro runtime workflows before claiming Kiro Crew, CLI, Web, power, or hook execution.

## Links

- **Demo video:** Add the exact URL of the newly public, reviewed, truthful 60 FPS YouTube upload before submitting. Do not use the historical `G-QZp8XgSVc` video; its claims conflict with this source boundary.
- **Source repository:** https://github.com/Devv66/Necro-ops

## Built With

`javascript` · `node.js` · `property-based-testing` · `finops` · `kiro`

## Do not claim until independently proven

- a real AWS scan, resource termination, saving, resource ID, or risk reduction;
- live Kiro Crew/CLI/Web execution;
- live Kiro hook or power execution;
- a signed action certificate; or
- Kiro bonus-track eligibility.
