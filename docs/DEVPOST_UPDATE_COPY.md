# NecroOps Devpost update — exact immediate changes

> Apply these edits only after the complete repaired source (including the root `.kiro/` tree) is publicly visible at `https://github.com/Devv66/Necro-ops`. Save the Devpost draft; do not make a final submission without reviewing the public URLs.

## 1. Replace the generic Try it out link

Replace:

```text
http://www.youtube.com
```

With exactly:

```text
https://www.youtube.com/watch?v=G-QZp8XgSVc
```

The submitted-video field already contains the real URL; the visible **Try it out** link must match it.

## 2. Replace the old static hash statement

Remove the old claimed action-certificate hash, especially:

```text
8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4
```

Use this exact audit statement instead:

> **Verifiable local-fixture audit record:** `npm run ci` completed with 0 failures on the audited source inventory. Node reported 16 nested checks and 17 TAP tests including its outer wrapper; the separate local safety gate passed 100/100 seeded trials. The audit did not connect to AWS, run Kiro Crew/CLI/Web, execute a Kiro hook or power, deploy a Lambda, or terminate an AWS resource. The audit pins the code with per-file SHA-256 values, so it remains verifiable even if the public repository receives a different Git commit ID through web upload. The SHA-256 digest of `docs/audit/necroops-fixture-mode-audit-log.json` is `39963b8a95a2d4a35452911764f8b904071b05a855649c4ee73a1b9a78c3a506`. Verify it with `sha256sum docs/audit/necroops-fixture-mode-audit-log.json`.

## 3. Replace the entire Story

Copy all content from:

```text
docs/DEVPOST_TRUTHFUL_REPLACEMENT.md
```

The Story now matches the repaired code: local fixtures, explicit API-backed dashboard behavior, a 100-trial seeded numerical gate, unsigned receipt digests, and Kiro-oriented assets labelled as illustrative/unverified.

## 4. Source and video links

- **Source repository:** `https://github.com/Devv66/Necro-ops`
- **Demo video / Try it out:** `https://www.youtube.com/watch?v=G-QZp8XgSVc`

## 5. Bonus Blog

Publish `docs/KIROWEEN_2026_BLOG_DRAFT.md` as a public third-party post during the contest submission period. It must keep the phrase **Kiroween Hackathon 2026**. Add the blog’s public URL to Devpost only after it is genuinely public.

## Never claim without separate proof

- real AWS scanning, saving, deletion, termination, or resource state;
- live Kiro Crew, CLI, Web, hook, power, or agent execution;
- an actual signed cloud-action certificate; or
- Kiro bonus-track eligibility.
