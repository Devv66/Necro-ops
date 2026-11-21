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
