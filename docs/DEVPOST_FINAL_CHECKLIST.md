# NecroOps Devpost Final Checklist

## Inspection snapshot

This checklist was prepared after inspecting the public Devpost project and the exact public `main` source at `b55c655f1ff2eb2b5f875dc47099fcf2e006c09c` on 2026-11-21. The project title, public description, tagline, video embed, and Built With entries were reviewed. No Devpost fields were edited or submitted during this task.

The current GitHub Actions run for that commit is run 41. Its Node 20 and Node 22 jobs, including `npm ci --ignore-scripts` and `npm run ci`, both completed successfully. Vercel reports the supplied production deployment as `READY`, target `production`, built from the same commit. The production URL redirects to Vercel login in the browser, so its application behavior could not be tested in this session.

## Fields to prepare

### Project title

Keep: `NecroOps`.

### Tagline

Suggested replacement:

> A local fixture prototype for risk-aware FinOps triage with a deterministic safety gate and simulated cleanup.

This describes the implementation without suggesting live cloud access.

### Project description

Suggested copy:

> NecroOps is a local, in-memory prototype for exploring safer FinOps cleanup workflows. It presents five modeled fixture workloads, fixture-specific JavaScript examples for two legacy-code fixtures, a seeded 100-trial numerical property gate, an idempotent simulated state transition, a reset to the initial fixture scenario, and an unsigned SHA-256 digest over a local receipt.
>
> The initial scenario models $1,050/month and an 88% risk index. These are fixture values, not an AWS bill, live resource findings, or verified savings. The workflow changes only local in-memory fixture state after its gate passes. The reset restores the five fixtures; it does not read or modify AWS.
>
> The repository includes illustrative `.kiro/` agent, hook, power, spec, and steering assets. No Kiro runtime execution is claimed: the project does not demonstrate a Kiro Crew, agent, hook, power, CLI, or Web session. The unsigned receipt digest is not a signed action certificate.

The published description already explains much of the local-only boundary. Before replacing it, compare this draft with the exact current Story and retain accurate details that remain useful.

### Built With

Suggested technology entries:

- JavaScript
- Node.js
- HTML and CSS
- Node.js built-in test runner
- Property-based testing
- GitHub Actions
- Vercel

Keep `FinOps` as a project category/topic only if Devpost offers it separately from technologies. Do not list AWS or Kiro runtime as a used integration or executed platform.

### Demo video URL

No new video URL is available from this task. The current published Devpost page embeds YouTube video ID `G-QZp8XgSVc`; the existing repository file `docs/DEVPOST_UPDATE_COPY.md` explicitly says that historical video contains claims that conflict with the local-fixture source and must not be reused. Do not copy that URL into a new field or invent a replacement.

After recording and uploading the truthful video described in `docs/DEMO_RECORDING_GUIDE.md`, verify its exact public URL and playback. Then update both `Demo video` and `Try it out` to that same URL. Until then, leave the fields unchanged and note that the video is pending.

### Testing instructions

Suggested public instructions:

```bash
npm ci --ignore-scripts
npm run ci
npm run audit:verify
npm start
```

Open `http://localhost:3000`. The application is local fixture simulation only. `npm run ci` runs the Node test suite and 100-trial fixture safety gate. `npm run audit:verify` checks the audit artifact against the exact checkout. The repository's Node 20 and Node 22 GitHub Actions jobs for commit `b55c655f1ff2eb2b5f875dc47099fcf2e006c09c` are recorded as successful in workflow run 41.

### Kiro usage explanation

Suggested copy:

> This repository includes structured, illustrative `.kiro/` project assets and tests their paths and documented runtime boundaries. No Kiro agent, Crew, hook, power, CLI, or Web execution is demonstrated by the checked-in source or CI evidence. The assets are not represented as executed Kiro features.

Only replace this statement if genuine Kiro runtime evidence is captured and reviewed. Do not make eligibility declarations based only on the presence of `.kiro/` files.

## Corrections to review before publishing

- The current public creator credit says the project designed Kiro Crew orchestration and an AST reanimation engine. The inspected source and README do not support those claims. Replace that credit with an accurate owner contribution, for example: “Solo developer: built the local fixture dashboard and API, deterministic safety gate, simulated workflow, receipt digest, regression tests, and illustrative Kiro project assets.”
- The current Story describes reset as restoring “local browser demo state.” Prefer “local in-memory fixture scenario through the app's same-origin API,” which matches the implementation more precisely.
- Do not call the receipt signed or an action certificate; it contains an unsigned SHA-256 digest.
- Do not call modeled costs actual AWS spend, modeled differences verified savings, or fixture transitions real cleanup.
- Do not mark Kiro, AWS, or eligibility declarations as completed without direct evidence.
- Verify the source URL, production URL, new video URL, and the latest audit digest after the final public source revision.

## Manual owner actions still needed

1. Record and upload a truthful video; no screen recording or upload was produced by this task.
2. Sign in to Devpost, review the exact live field values, apply the approved corrections, and verify the public page. Do not submit a final hackathon entry or eligibility declaration without owner review.
3. Provide an authorized way to view the Vercel-protected production page if browser-level production acceptance is required. The tested URL currently redirects to Vercel login; this task did not create a temporary deployment share link or alter access settings.
4. If the submission requires actual Kiro use, run Kiro yourself or provide genuine session evidence before making that claim.
