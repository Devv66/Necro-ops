# NecroOps reference steering guidance

> **Runtime boundary:** This is a Kiro-oriented project asset stored in the repository. It is **not automatically injected** into a Kiro conversation by the local Node server, and its presence is not evidence of a Kiro runtime session.

## 1. Truthful local-fixture boundary

- Treat every catalog row, identifier, risk value, cost, receipt, and state transition as a local demo fixture unless independently proven otherwise.
- Do not state or imply AWS API access, CloudWatch queries, Cost Explorer data, resource termination, savings, Kiro Crew execution, or live hook execution.
- Do not convert a simulated receipt digest into a claim of a signed cloud-action certificate.

## 2. Fixture example handling

- Keep generated examples fixture-specific: payment-worker and billing-webhook examples must not share an unrelated template.
- Label all examples as JavaScript examples and not deployed artifacts.
- Preserve input validation and use integer cents for the modeled financial property.

## 3. Local numerical gate

- A simulated state transition runs 100 seeded local trials first.
- Each accepted fixture amount must make the local legacy rule and local example rule agree in integer cents.
- Net cents plus fee cents must equal gross cents; values that cannot cover the fixed fixture fee are rejected.
- A failed gate must leave both the in-memory fixture state and receipt log unchanged.

## 4. Idempotency and receipts

- Re-running simulated cleanup against an already transitioned record returns `ALREADY_EXORCISED` without a second mutation.
- Build a receipt from one captured timestamp and hash the canonical receipt fields.
- Call the result an unsigned local fixture receipt digest, not a cryptographic signature.

## 5. Future live integrations

Any AWS or Kiro integration requires separate test-account approval, least-privilege review, human confirmation, and independently captured runtime evidence before it can be claimed.
