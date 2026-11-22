# NecroOps Demo Recording Guide

## Recording boundary

This guide is a truthful recording plan. No video was recorded or uploaded as part of this repository task. Record the application locally; do not imply that the demo is connected to AWS or that a Kiro runtime executed.

The application is a local in-memory fixture prototype. Fixture identifiers, modeled costs, risk scores, workflow output, receipts, and state transitions are demo data. The initial five-fixture scenario is modeled at $1,050/month with an 88% risk index. Neither number is an AWS observation or verified saving.

## Prepare the local demo

Use Node.js 20 or newer and run:

```bash
npm ci --ignore-scripts
npm run ci
npm run audit:verify
npm start
```

Open `http://localhost:3000`. Confirm that the banner says `LOCAL DEMO FIXTURES — NO AWS ACCOUNT CONNECTED` and that the five fixtures, modeled total, and risk index are at their initial values. If port 3000 is occupied, stop the other local server or set an unused `PORT` supported by the local server before recording.

Do not enter credentials, API keys, or private account data. Close unrelated tabs and hide notifications before capture.

## Under-three-minute script (about 2:45)

| Time | On screen | Truthful narration |
| --- | --- | --- |
| 0:00-0:12 | App title and local-demo banner | “NecroOps is a local fixture prototype. It does not connect to AWS or change cloud resources.” |
| 0:12-0:32 | Initial dashboard with five workloads | “These five records are fixtures. The $1,050 monthly total and 88% risk index are modeled scenario values, not an AWS bill or savings claim.” |
| 0:32-0:50 | Open the payment-worker fixture and its JavaScript example | “The app includes fixture-specific code examples for two supplied legacy-code fixtures. These examples are not deployed.” |
| 0:50-1:18 | Click `Run local fixture workflow`; show the gate result and feed | “The local workflow runs its seeded 100-trial numerical property gate before it changes the in-memory fixture state. A failed gate prevents the transition.” |
| 1:18-1:38 | Show `LOCAL FIXTURE RECEIPT - UNSIGNED`, the trial count, and SHA-256 digest | “This is an unsigned digest over a local fixture receipt. It is not a signed certificate or proof of a cloud action.” |
| 1:38-1:58 | Show the passing CI output for the idempotent retry test | “The regression suite verifies a repeat for the same fixture is reported as already processed and does not create a second state change or receipt.” |
| 1:58-2:22 | Click `Reset Local Fixture Scenario`; show five fixtures restored | “Reset restores the local scenario to five active fixtures, an 88% modeled risk index, and $1,050 monthly modeled cost. It does not reset or contact AWS.” |
| 2:22-2:45 | Show the README Kiro boundary or this guide's Kiro note | “The repository contains illustrative `.kiro/` assets. I am not claiming that a Kiro Crew, agent, hook, power, CLI, or Web session ran.” |

The idempotency evidence is the real test named `orchestration reports a truthful, zero-change idempotent retry` in `tests/necroops.test.mjs`. Show the actual `npm test` output; do not stage or fabricate a terminal result.

## Capture and publish checklist

- Keep the video below three minutes and capture the real local app and real command output.
- Use readable browser zoom and a clean desktop; record at 1080p if available. Do not claim a frame rate that was not measured.
- Use voice-over or silence. Do not add copyrighted music without permission.
- Do not fake terminal output, agent activity, AWS operations, Kiro execution, savings, or benchmarks.
- Do not show credentials, private browser tabs, unrelated local files, or user notifications.
- Before upload, review every spoken and on-screen claim against `README.md` and the source.
- Upload the finished recording to the owner's chosen public video host, then manually copy its exact public URL into Devpost's `Demo video` and `Try it out` fields. Do not invent or reserve a URL.
- Open the published video URL in a signed-out browser and verify playback before updating Devpost.

## Kiro usage statement

The repository contains illustrative `.kiro/` agent, hook, power, spec, and steering files. The source tests verify their presence and their stated runtime boundary. Their presence does not demonstrate that Kiro ran them. This guide therefore does not include a Kiro execution segment. Add one only if the owner can capture genuine Kiro runtime evidence and the segment remains within the time limit.
