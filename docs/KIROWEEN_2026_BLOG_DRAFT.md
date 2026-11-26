# How I used Kiro-oriented project assets to make a cloud-cleanup prototype more inspectable

*Written for the Kiroween Hackathon 2026.*

Cloud cleanup sounds simple until an old workload touches a shared database, an abandoned volume, or a deployment path no one wants to break. That uncertainty is the idea behind **NecroOps**: a playful, darkly themed **local fixture prototype** for reasoning about zombie-cloud scenarios and safer cleanup decisions.

## The important boundary

NecroOps does **not** connect to AWS. It does not query CloudWatch or Cost Explorer, deploy Lambda code, terminate resources, or execute a Kiro Crew runtime. Its workload catalog, identifiers, modeled costs, risk scores, code examples, dashboard state, and cleanup results are in-memory demo fixtures.

That boundary is intentional. A dashboard should not turn a simulation into an unearned production claim.

## Kiro-oriented assets as inspectable design artifacts

I built NecroOps for the **Kiroween Hackathon 2026** around visible, structured project assets rather than one giant opaque prompt. The repository includes a `.kiro` directory with three illustrative role manifests — Necromancer, Reaper, and Exorcist — plus a spec, reference steering guidance, hook definitions, and an unattached least-privilege permission manifest.

Each asset now carries an explicit note that it is illustrative and unverified at runtime. The local Node server does not automatically inject the steering document, execute a hook, invoke an agent, or attach the permission manifest. That wording matters: files in a repository are evidence of project design, not evidence that a hosted runtime ran them.

## The local safety experiment

The simulator has a deliberately small safety property. Before it changes an in-memory fixture record, it runs an exhaustive integer-cent gate over the bounded settleable domain (32 through 1,500,000 cents). For each amount, it checks that:

1. the fixture’s legacy fee rule and local JavaScript example rule agree; and
2. net cents plus fee cents equal the gross amount.

Amounts that cannot cover the modeled fixed fee are rejected. A forced-failure test checks that a failed gate leaves the local resource state and receipt log unchanged. The seeded 100-trial routine remains supplementary deterministic testing; it is not the cleanup gate.

The result is not a production authorization or an AWS safety guarantee. It is a reproducible local demonstration of a narrow numerical claim.

## Making a demo honest in the UI

The dashboard loads its ledger and metrics from the same-origin API. In production, browser-session state is persisted through the Supabase session gateway with an atomic database compare-and-swap revision check; tests exercise that contract with deterministic in-memory stores, not a live Supabase project. Its button sends an explicit fixture target, renders the returned workflow result, and shows errors instead of timer-only success. The receipt is labeled as unsigned and includes a SHA-256 digest of the canonical local receipt fields. That digest can detect a changed receipt, but it is not a signature or proof of a real cloud action.

## What I would take into a production version

A production version would need a separately approved non-production AWS account, least-privilege credentials stored outside the repository, human approvals, dry-run controls, audit retention, and captured evidence for every AWS or Kiro runtime claim. The core principle would remain the same: keep the safety boundary visible, keep the human in charge, and make the evidence match the claim.

---

**Publishing checklist**

1. Publish this on DEV Community, Medium, Hashnode, or another public third-party blog platform during the Kiroween submission period.
2. Keep the phrase **“Kiroween Hackathon 2026”** in the published post.
3. Add the public article URL to the Kiroween Devpost bonus-blog field only after it is genuinely public.
4. Do not claim a prize is guaranteed. The official Bonus Blog award is Kiro credits for eligible top-scoring entries, not cash.
