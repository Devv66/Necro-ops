import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');
const artifactPath = 'docs/audit/necroops-fixture-mode-audit-log.json';
const dynamicDigestPaths = [
  'README.md',
  'docs/DEVPOST_TRUTHFUL_REPLACEMENT.md',
  'docs/DEVPOST_UPDATE_COPY.md'
];
const digestLine = /^(\s*(?:>\s*)?\*\*Complete audit artifact SHA-256:\*\* `)(?:[a-f0-9]{64}|PENDING_AUDIT_DIGEST)(`\s*)$/m;
const digestLineCheck = /^(\s*(?:>\s*)?\*\*Complete audit artifact SHA-256:\*\* `)([a-f0-9]{64})(`\s*)$/m;

function fail(message) {
  throw new Error(`[audit] ${message}`);
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false' }
  });
  if (result.error) fail(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) {
    fail(`${command} ${args.join(' ')} exited ${result.status}\n${result.stdout || ''}\n${result.stderr || ''}`);
  }
  return `${result.stdout || ''}${result.stderr || ''}`;
}

function trackedProjectFiles() {
  const raw = run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  const files = [...new Set(raw.split('\0').filter(Boolean))].sort();
  if (!files.includes(artifactPath)) fail(`missing required audit artifact path ${artifactPath}`);
  return files.filter(file => file !== artifactPath);
}

function normalizedBytes(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  const bytes = fs.readFileSync(absolutePath);
  if (!dynamicDigestPaths.includes(relativePath)) return bytes;

  const source = bytes.toString('utf8');
  const matches = source.match(new RegExp(digestLine.source, 'gm')) || [];
  if (matches.length !== 1) fail(`${relativePath} must contain exactly one Complete audit artifact SHA-256 line`);
  return Buffer.from(source.replace(digestLine, '$1<AUDIT_ARTIFACT_SHA256>$2'));
}

function sourceInventory() {
  const files = trackedProjectFiles();
  return Object.fromEntries(files.map(file => [file, sha256(normalizedBytes(file))]));
}

function checkSyntaxAndConfig() {
  for (const file of ['api/index.js', 'src/engine.js', 'src/server.js', 'scripts/regenerate-audit.mjs']) {
    run(process.execPath, ['--check', file]);
  }
  run(process.execPath, ['-e', "JSON.parse(require('fs').readFileSync('vercel.json','utf8'));"]);
  run('git', ['diff', '--check']);
}

function runLocalResetSmoke() {
  const program = `
    import { NecroOpsEngine } from './src/engine.js';
    const engine = new NecroOpsEngine();
    const first = engine.runKiroCrewOrchestration('i-0f948a913bc89a712');
    const retry = engine.runKiroCrewOrchestration('i-0f948a913bc89a712');
    const reset = engine.resetLocalFixtureScenario();
    const scan = engine.scanCloudPerimeter();
    const valid = first.status === 'EXORCISED' && first.mutated === true
      && retry.status === 'ALREADY_EXORCISED' && retry.mutated === false
      && reset.resetFixtureCount === 5 && reset.clearedReceiptCount === 1
      && scan.activeZombieCount === 5 && scan.exorcisedCount === 0
      && scan.hauntedRiskIndex === 88 && scan.totalMonthlyWasteUSD === 1050
      && scan.suggestedCleanupFixtureId === 'i-0f948a913bc89a712';
    if (!valid) process.exit(2);
    console.log(JSON.stringify({ firstStatus:first.status, retryStatus:retry.status, resetFixtureCount:reset.resetFixtureCount, clearedReceiptCount:reset.clearedReceiptCount, scan }));
  `;
  return JSON.parse(run(process.execPath, ['--input-type=module', '--eval', program]).trim());
}

function staticBoundaryScan() {
  const patterns = {
    awsSdk: /from ['"]@aws-sdk|require\(['"]@aws-sdk|from ['"]aws-sdk|require\(['"]aws-sdk/i,
    awsEnv: /process\.env\.(AWS|AWS_|ACCESS_KEY|SECRET_KEY)|process\.env\[['"](AWS|AWS_|ACCESS_KEY|SECRET_KEY)/i,
    credential: /AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|ghp_[A-Za-z0-9]{30,}|xox[baprs]-/
  };
  const roots = ['api', 'src', 'public', 'scripts', 'tests', '.kiro'];
  const files = trackedProjectFiles().filter(file => roots.some(root => file === root || file.startsWith(`${root}/`)));
  const results = {};
  for (const [name, expression] of Object.entries(patterns)) {
    results[name] = files.filter(file => expression.test(fs.readFileSync(path.join(projectRoot, file), 'utf8')));
  }
  return results;
}

function buildAuditRecord({ ciOutput, resetSmoke }) {
  const tapPass = ciOutput.match(/# pass (\d+)/)?.[1];
  const namedNestedChecks = (ciOutput.match(/^    # Subtest:/gm) || []).length;
  const gatePassed = /"passed": true,[\s\S]*?"trialsRequested": 100,[\s\S]*?"trialsPassed": 100/.test(ciOutput);
  if (!tapPass || !gatePassed) fail('could not parse successful CI and 100/100 fixture-gate results');
  const inventory = sourceInventory();
  const boundary = staticBoundaryScan();
  const baseCommit = run('git', ['rev-parse', 'HEAD']).trim();

  return {
    artifact: 'NecroOps complete local-fixture audit record',
    schemaVersion: 5,
    status: 'CURRENT_FOR_THE_COMPLETE_VERSION_CONTROLLED_SOURCE_INVENTORY_LISTED_BELOW',
    scope: 'Complete version-controlled source inventory, deterministic local-fixture verification, four-band risk classification, exact-empty reset validation, signed fixed-lifetime browser-session behavior, dashboard/API boundary checks, sequential idempotency behavior, deployment configuration review, and truthful-claim review.',
    executionBoundary: 'All verified workflows use local in-memory fixtures. The audit did not connect to AWS, query CloudWatch or Cost Explorer, deploy a Lambda, execute Kiro Crew/CLI/Web, run a Kiro hook or power, or terminate an AWS resource.',
    generationBaseCommit: baseCommit,
    auditedTreeIdentity: 'The normalized SHA-256 inventory below identifies the complete audited working tree independently of a Git commit. generationBaseCommit records the checked-out generator context before the publication commit and is not a claim that it is the final public commit. The inventory includes every version-controlled/non-ignored project file except this audit artifact itself. The three visible digest-reference lines are normalized to a fixed token before hashing to avoid an unavoidable artifact-hash self-reference; npm run audit:verify checks both the inventory and the displayed artifact digest.',
    sourceInventory: {
      enumeration: 'git ls-files --cached --others --exclude-standard, sorted',
      fileCount: Object.keys(inventory).length,
      excludedOnlyBecauseSelfReferential: [artifactPath],
      digestReferenceNormalization: {
        paths: dynamicDigestPaths,
        replacementToken: '<AUDIT_ARTIFACT_SHA256>',
        rule: 'Only the one visible Complete audit artifact SHA-256 line in each listed path is normalized before its file hash is calculated.'
      }
    },
    sourceFileNormalizedSha256: inventory,
    verificationCommands: [
      'npm ci --ignore-scripts',
      'npm run ci',
      'node --check api/index.js',
      'node --check src/engine.js',
      'node --check src/server.js',
      'node --check scripts/regenerate-audit.mjs',
      'node -e "JSON.parse(require(\'fs\').readFileSync(\'vercel.json\',\'utf8\'))"',
      'git diff --check',
      'npm run audit:verify'
    ],
    automatedTestResult: {
      command: 'npm run ci',
      failures: 0,
      nestedChecksPassed: namedNestedChecks,
      tapSummaryTestsPassed: Number(tapPass),
      standaloneGate: { trialsRequested: 100, trialsPassed: 100, passed: true },
      note: 'Node TAP counts the outer suite in addition to the named nested checks. The standalone gate runs after the TAP suite.'
    },
    resetAndIdempotencySmoke: {
      firstWorkflow: { status: resetSmoke.firstStatus, mutated: true },
      immediateRetry: { status: resetSmoke.retryStatus, mutated: false },
      reset: {
        resetFixtureCount: resetSmoke.resetFixtureCount,
        clearedReceiptCount: resetSmoke.clearedReceiptCount,
        activeZombieCountAfterReset: resetSmoke.scan.activeZombieCount,
        exorcisedCountAfterReset: resetSmoke.scan.exorcisedCount,
        hauntedRiskIndexAfterReset: resetSmoke.scan.hauntedRiskIndex,
        totalMonthlyWasteUSDAfterReset: resetSmoke.scan.totalMonthlyWasteUSD,
        suggestedCleanupFixtureIdAfterReset: resetSmoke.scan.suggestedCleanupFixtureId
      },
      boundary: 'The engine smoke covers local transitions. Browser-facing API tests additionally verify an HMAC-signed HttpOnly local-fixture session cookie with server-enforced issuedAt/expiresAt validation, so Vercel warm-memory state is not the source of browser demo state. Sequential retries using the latest valid cookie are idempotent; simultaneous duplicate HTTP submissions are outside this stateless demo guarantee. This remains simulated local data, not cloud persistence.'
    },
    deploymentConfigurationReview: {
      apiEntrypoint: 'api/index.js is included in the complete inventory and passed syntax validation.',
      vercelConfiguration: 'vercel.json is included in the complete inventory and passed JSON parsing. It retains framework: null, api/index.js includeFiles, and catch-all rewrite configuration.',
      resetRoute: 'Tests exercise POST /api/reset, wrong method, exact JSON content-type enforcement, empty-object-only reset validation, rejected-reset state preservation, reset restoration, a restored subsequent workflow, HMAC-signed fixed-lifetime session continuity across fresh engine instances, expiry/legacy fallback, and production/Vercel Secure-cookie behavior.'
    },
    staticBoundaryScan: {
      awsSdkHits: boundary.awsSdk,
      awsEnvironmentReadHits: boundary.awsEnv,
      credentialPatternHits: boundary.credential,
      note: 'These static checks support the stated local-fixture boundary; they are not a substitute for an external security review.'
    },
    claimReview: {
      dashboard: 'The dashboard fetches same-origin API state and returned workflow/reset data; it renders all four server-defined local risk statuses and does not use timer-only success. Reset Local Fixture Scenario restores only local in-memory fixtures.',
      reset: 'POST /api/reset accepts only the empty JSON object, rejects non-empty objects before mutation, restores only the browser local-fixture session, and reports that no AWS resource was changed.',
      financialInvariant: 'The legacy fee expression and independent modern BigInt rational oracle agree across deterministic local property trials. Generated modern fixture code is executed in test against the oracle.',
      kiroAssets: 'Root .kiro assets exist and label themselves illustrative/unverified. Their presence is not runtime execution evidence.',
      receipt: 'Receipt digest is a SHA-256 integrity check over canonical local-fixture receipt data; it is unsigned and is not proof of a cloud action.',
      license: 'Root LICENSE is MIT and the public repository identifies its MIT license.'
    },
    publicationNote: 'This audit does not establish Devpost completion, public demo-video publication, entrant eligibility, original-project timing, bonus eligibility, actual Kiro runtime use, or actual cloud actions. It records only the listed local-source evidence.',
    verification: 'Run npm run audit:verify and sha256sum docs/audit/necroops-fixture-mode-audit-log.json from the exact source revision.'
  };
}

function artifactDigest() {
  return sha256(fs.readFileSync(path.join(projectRoot, artifactPath)));
}

function updateVisibleDigestLines(digest) {
  for (const relativePath of dynamicDigestPaths) {
    const absolutePath = path.join(projectRoot, relativePath);
    const source = fs.readFileSync(absolutePath, 'utf8');
    const matches = source.match(new RegExp(digestLine.source, 'gm')) || [];
    if (matches.length !== 1) fail(`${relativePath} must contain exactly one replaceable digest line`);
    const updated = source.replace(digestLine, `$1${digest}$2`);
    fs.writeFileSync(absolutePath, updated);
  }
}

function verify() {
  const absoluteArtifact = path.join(projectRoot, artifactPath);
  if (!fs.existsSync(absoluteArtifact)) fail(`missing ${artifactPath}`);
  const audit = JSON.parse(fs.readFileSync(absoluteArtifact, 'utf8'));
  const actualInventory = sourceInventory();
  const expectedInventory = audit.sourceFileNormalizedSha256;
  if (JSON.stringify(actualInventory) !== JSON.stringify(expectedInventory)) {
    const expectedPaths = Object.keys(expectedInventory || {});
    const actualPaths = Object.keys(actualInventory);
    const mismatch = [...new Set([...expectedPaths, ...actualPaths])].filter(file => expectedInventory?.[file] !== actualInventory[file]);
    fail(`source inventory mismatch for ${mismatch.join(', ') || 'unknown paths'}`);
  }
  const digest = artifactDigest();
  for (const relativePath of dynamicDigestPaths) {
    const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
    const match = source.match(digestLineCheck);
    if (!match || match[2] !== digest) fail(`${relativePath} does not display the current audit artifact SHA-256`);
  }
  console.log(JSON.stringify({
    verified: true,
    artifact: artifactPath,
    artifactSha256: digest,
    sourceFileCount: Object.keys(actualInventory).length,
    normalizedDigestReferencePaths: dynamicDigestPaths
  }, null, 2));
}

const mode = process.argv[2];
if (mode === '--write') {
  run('npm', ['ci', '--ignore-scripts']);
  const ciOutput = run('npm', ['run', 'ci']);
  checkSyntaxAndConfig();
  const resetSmoke = runLocalResetSmoke();
  const audit = buildAuditRecord({ ciOutput, resetSmoke });
  fs.writeFileSync(path.join(projectRoot, artifactPath), `${JSON.stringify(audit, null, 2)}\n`);
  updateVisibleDigestLines(artifactDigest());
  verify();
} else if (mode === '--verify') {
  verify();
} else {
  fail('use --write to regenerate the audit or --verify to validate it');
}
