import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  calculateLegacyFixturePayment,
  calculateModernFixturePayment,
  classifyFixtureRiskIndex,
  NecroOpsEngine,
  RISK_STATUS_THRESHOLDS,
  verifyFixtureReceipt,
  ZOMBIE_CATALOG
} from '../src/engine.js';
import { createServer } from '../src/server.js';
import vercelHandler from '../api/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

function startIsolatedServer(options = {}) {
  const server = createServer({ engine: new NecroOpsEngine(), ...options });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`
      });
    });
  });
}

async function startBrowserSessionServer(options = {}) {
  const server = createServer(options);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`
      });
    });
  });
}

async function startVercelAdapterServer() {
  const server = http.createServer((req, res) => {
    const original = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const rewritten = new URLSearchParams(original.search);
    rewritten.set('__necroops_path', original.pathname.replace(/^\//, ''));
    req.url = `/api?${rewritten.toString()}`;
    vercelHandler(req, res).catch(error => {
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: error.message }));
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

async function stopServer(server) {
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

async function request(baseUrl, pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { response, body };
}

function signedSessionCookie(payload, signingKey) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', signingKey).update(encodedPayload).digest('base64url');
  return `necroops_local_fixture_state=${encodedPayload}.${signature}`;
}

function sessionPayloadFromSetCookie(setCookie) {
  const cookie = String(setCookie || '').split(';')[0];
  const [, signedValue] = cookie.split('=');
  const [payload] = String(signedValue || '').split('.');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
}

test('NecroOps local fixture suite', async (t) => {
  let engine;

  t.beforeEach(() => {
    engine = new NecroOpsEngine();
  });

  await t.test('fixture catalog has five local scenario records', () => {
    assert.equal(ZOMBIE_CATALOG.length, 5);
    const scan = engine.scanCloudPerimeter();
    assert.equal(scan.executionMode, 'local-demo-fixture');
    assert.equal(scan.activeZombieCount, 5);
    assert.equal(scan.exorcisedCount, 0);
    assert.equal(scan.totalMonthlyWasteUSD, 1050);
    assert.equal(scan.annualWasteProjectionUSD, 12600);
    assert.equal(scan.hauntedRiskIndex, 88);
    assert.equal(scan.status, 'CRITICAL_HAUNTED');
  });

  await t.test('risk-status thresholds match the local specification at every boundary', () => {
    const spec = JSON.parse(fs.readFileSync(path.join(projectRoot, '.kiro/specs/necroops-spec.json'), 'utf8'));
    assert.deepEqual(RISK_STATUS_THRESHOLDS, { critical: 80, warning: 40, lowRisk: 20 });
    assert.deepEqual(spec.entities.fixtureWorkloads.riskStatusBands, [
      { minimumInclusive: 80, status: 'CRITICAL_HAUNTED' },
      { minimumInclusive: 40, status: 'EERIE_WARNING' },
      { minimumInclusive: 20, status: 'LOW_RISK_FIXTURES' },
      { minimumInclusive: 0, status: 'SANCTIFIED_CLEAN' }
    ]);

    for (const [score, status] of [
      [100, 'CRITICAL_HAUNTED'], [80, 'CRITICAL_HAUNTED'], [79, 'EERIE_WARNING'],
      [40, 'EERIE_WARNING'], [39, 'LOW_RISK_FIXTURES'], [20, 'LOW_RISK_FIXTURES'],
      [19, 'SANCTIFIED_CLEAN'], [0, 'SANCTIFIED_CLEAN']
    ]) {
      assert.equal(classifyFixtureRiskIndex(score), status, `score ${score}`);
    }
    assert.throws(() => classifyFixtureRiskIndex(-1), RangeError);
    assert.throws(() => classifyFixtureRiskIndex(101), RangeError);
  });

  await t.test('scan results are stable snapshots, not live references', () => {
    const before = engine.scanCloudPerimeter();
    engine.exorciseZombieResource('i-0f948a913bc89a712');
    const after = engine.scanCloudPerimeter();

    assert.equal(before.activeZombieCount, 5);
    assert.equal(before.resources.find(resource => resource.id === 'i-0f948a913bc89a712').status, 'HAUNTED_ZOMBIE');
    assert.equal(after.activeZombieCount, 4);
    assert.equal(after.resources.find(resource => resource.id === 'i-0f948a913bc89a712').status, 'EXORCISED');
  });

  await t.test('cleanup candidates are explicitly ranked by risk then modeled cost', () => {
    const candidates = engine.getCleanupCandidates();
    assert.equal(candidates[0].id, 'i-0f948a913bc89a712');
    assert.equal(candidates[1].id, 'rds-cluster-legacy-analytics-store');
    assert.equal(candidates[2].id, 'vol-084920491823abf10');
  });

  await t.test('resurrection examples are fixture-specific and not described as deployed transformations', () => {
    const paymentExample = engine.resurrectLegacyCode('i-0f948a913bc89a712');
    const webhookExample = engine.resurrectLegacyCode('arn:aws:lambda:us-east-1:718293019283:function:billing-webhook-v1');

    assert.equal(paymentExample.exampleLanguage, 'JavaScript');
    assert.equal(paymentExample.deploymentStatus, 'not-deployed');
    assert.match(paymentExample.modernizedExample, /feeCents/);
    assert.match(webhookExample.modernizedExample, /Missing token/);
    assert.match(webhookExample.modernizedExample, /transactionId/);
    assert.notEqual(paymentExample.modernizedExample, webhookExample.modernizedExample);
  });

  await t.test('resurrection rejects fixture resources without code and unknown IDs', () => {
    assert.throws(() => engine.resurrectLegacyCode('vol-084920491823abf10'), { code: 'NO_LEGACY_CODE' });
    assert.throws(() => engine.resurrectLegacyCode('not-real'), { code: 'RESOURCE_NOT_FOUND' });
  });

  await t.test('cent-based fixture arithmetic preserves money and uses independent local formula representations', () => {
    const amounts = [32, 101, 5025, 10000, 99999, 1500000];
    for (const amountCents of amounts) {
      const legacy = calculateLegacyFixturePayment(amountCents);
      const modern = calculateModernFixturePayment(amountCents);
      assert.deepEqual(legacy, modern);
      assert.equal(modern.netCents + modern.feeCents, amountCents);
      assert.ok(modern.netCents >= 0);
    }
    assert.throws(() => calculateLegacyFixturePayment(Number.MAX_SAFE_INTEGER), RangeError);
    assert.throws(() => calculateModernFixturePayment(Number.MAX_SAFE_INTEGER), RangeError);
  });

  await t.test('financial invariant rejects invalid, fractional-cent, unsafe, and out-of-domain values', () => {
    for (const amount of [-10, 0, Number.NaN, Number.POSITIVE_INFINITY, 0.01, 0.31, 10.001, 15000.01, 1e20, Number.MAX_VALUE]) {
      assert.equal(engine.verifyPropertyBasedInvariants({ amount }).valid, false);
    }
    const valid = engine.verifyPropertyBasedInvariants({ amount: 0.32 });
    assert.equal(valid.valid, true);
    assert.equal(valid.inputAmountCents, 32);
    assert.equal(valid.sumCheckCents, 32);
    assert.equal(valid.legacyAndExampleEquivalent, true);
    assert.equal(valid.moneyConserved, true);
  });

  await t.test('generated modern payment example executes and agrees with the independent local oracle', async () => {
    // This fixture string is emitted by the checked-in engine, never request input.
    // Executing it here verifies the example artifact rather than treating it as a claim.
    const modernizedExample = engine.resurrectLegacyCode('i-0f948a913bc89a712').modernizedExample;
    const createHandler = new Function(`${modernizedExample.replace('export async function handler', 'async function handler')}\nreturn handler;`);
    const handler = createHandler();
    const amount = 100.01;
    const response = await handler({ body: JSON.stringify({ amount }) });
    const body = JSON.parse(response.body);
    const expected = calculateModernFixturePayment(10001);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(body, { success: true, fee: expected.feeCents / 100, net: expected.netCents / 100 });
    const rejected = await handler({ body: JSON.stringify({ amount: 0.31 }) });
    assert.equal(rejected.statusCode, 400);
  });

  await t.test('property gate is deterministic for a fixed seed and trial count', () => {
    const first = engine.runPropertyBasedTests(25, 123456);
    const second = engine.runPropertyBasedTests(25, 123456);
    assert.deepEqual(first, second);
    assert.equal(first.passed, true);
    assert.equal(first.trialsPassed, 25);
    assert.throws(() => engine.runPropertyBasedTests(0), { code: 'INVALID_TRIAL_COUNT' });
  });

  await t.test('failed gate leaves local resource state and receipt log unchanged', () => {
    const before = engine.scanCloudPerimeter();
    engine.runPropertyBasedTests = () => ({ passed: false, failures: [{ trial: 1 }], trialsRequested: 100, trialsPassed: 99 });

    assert.throws(
      () => engine.exorciseZombieResource('i-0f948a913bc89a712'),
      { code: 'SAFETY_GATE_FAILED' }
    );

    const after = engine.scanCloudPerimeter();
    assert.equal(after.activeZombieCount, before.activeZombieCount);
    assert.equal(after.exorcisedCount, before.exorcisedCount);
    assert.equal(after.resources.find(resource => resource.id === 'i-0f948a913bc89a712').status, 'HAUNTED_ZOMBIE');
  });

  await t.test('cleanup returns a locally verifiable unsigned fixture receipt', () => {
    const receipt = engine.exorciseZombieResource('i-0f948a913bc89a712', 'Test local receipt');
    assert.match(receipt.receiptId, /^LOCAL-FIXTURE-RECEIPT-/);
    assert.equal(receipt.executionMode, 'local-demo-fixture');
    assert.equal(receipt.propertyBasedSafetyGate.trialsRequested, 100);
    assert.equal(receipt.propertyBasedSafetyGate.trialsPassed, 100);
    assert.equal(verifyFixtureReceipt(receipt), true);

    const tampered = structuredClone(receipt);
    tampered.modeledMonthlyChangeUSD = 999999;
    assert.equal(verifyFixtureReceipt(tampered), false);
  });

  await t.test('cleanup is idempotent for sequential retries within one engine process', () => {
    engine.exorciseZombieResource('vol-084920491823abf10');
    const repeat = engine.exorciseZombieResource('vol-084920491823abf10');
    assert.equal(repeat.status, 'ALREADY_EXORCISED');
    assert.equal(repeat.executionMode, 'local-demo-fixture');
  });

  await t.test('explicit local reset restores the complete initial fixture scenario', () => {
    engine.exorciseZombieResource('i-0f948a913bc89a712');
    engine.exorciseZombieResource('vol-084920491823abf10');
    const reset = engine.resetLocalFixtureScenario();

    assert.equal(reset.executionMode, 'local-demo-fixture');
    assert.equal(reset.resetFixtureCount, 5);
    assert.equal(reset.clearedTransitionCount, 2);
    assert.match(reset.message, /No AWS resource was changed/);
    assert.equal(reset.updatedScan.activeZombieCount, 5);
    assert.equal(reset.updatedScan.exorcisedCount, 0);
    assert.equal(reset.updatedScan.hauntedRiskIndex, 88);
    assert.equal(reset.updatedScan.totalMonthlyWasteUSD, 1050);
    assert.equal(reset.updatedScan.suggestedCleanupFixtureId, 'i-0f948a913bc89a712');
    assert.equal(reset.updatedScan.resources.find(resource => resource.id === 'i-0f948a913bc89a712').status, 'HAUNTED_ZOMBIE');
  });

  await t.test('local-fixture session restores only validated simulated transition IDs', () => {
    engine.exorciseZombieResource('i-0f948a913bc89a712');
    const session = engine.exportLocalFixtureSession();
    assert.deepEqual(session, { version: 1, exorcisedFixtureIds: ['i-0f948a913bc89a712'] });

    const restored = new NecroOpsEngine();
    assert.equal(restored.restoreLocalFixtureSession(session), true);
    assert.equal(restored.scanCloudPerimeter().activeZombieCount, 4);
    assert.equal(restored.runKiroCrewOrchestration('i-0f948a913bc89a712').status, 'ALREADY_EXORCISED');

    const rejected = new NecroOpsEngine();
    assert.equal(rejected.restoreLocalFixtureSession({ version: 1, exorcisedFixtureIds: ['not-a-fixture'] }), false);
    assert.equal(rejected.scanCloudPerimeter().activeZombieCount, 5);
  });

  await t.test('orchestration reports a truthful, zero-change sequential idempotent retry', () => {
    assert.throws(() => engine.runKiroCrewOrchestration(), { code: 'RESOURCE_ID_REQUIRED' });
    const workflow = engine.runKiroCrewOrchestration('i-0f948a913bc89a712');
    assert.equal(workflow.status, 'EXORCISED');
    assert.equal(workflow.mutated, true);
    assert.equal(workflow.executionMode, 'local-demo-fixture');
    assert.equal(workflow.actionsTaken.length, 3);
    assert.equal(workflow.updatedScan.activeZombieCount, 4);
    assert.equal(workflow.updatedScan.hauntedRiskIndex, 65);
    assert.equal(workflow.updatedScan.status, 'EERIE_WARNING');
    assert.equal(workflow.localFixtureReceipt.propertyBasedSafetyGate.trialsPassed, 100);

    const repeat = engine.runKiroCrewOrchestration('i-0f948a913bc89a712');
    assert.equal(repeat.status, 'ALREADY_EXORCISED');
    assert.equal(repeat.mutated, false);
    assert.equal(repeat.modeledMonthlyChangeUSD, 0);
    assert.equal(repeat.localFixtureReceipt, null);
    assert.equal(repeat.resurrectionSummary, null);
    assert.equal(repeat.actionsTaken.at(-1).action, 'LOCAL_NO_OP_ALREADY_EXORCISED');
    assert.match(repeat.actionsTaken.at(-1).detail, /No local state transition was performed/);
  });

  await t.test('workflow execution IDs are UUID-backed and unique across rapid local workflows', () => {
    const workflows = Array.from({ length: 24 }, () => new NecroOpsEngine().runKiroCrewOrchestration('i-0f948a913bc89a712'));
    const workflowIds = workflows.map(workflow => workflow.workflowSessionId);

    assert.equal(new Set(workflowIds).size, workflowIds.length);
    for (const workflowId of workflowIds) {
      assert.match(workflowId, /^LOCAL-SIM-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    }
  });

  await t.test('all required Kiro-oriented assets are tracked at the correct root paths', () => {
    const requiredPaths = [
      '.kiro/agents/reaper-agent.json',
      '.kiro/agents/necromancer-agent.json',
      '.kiro/agents/exorcist-agent.json',
      '.kiro/hooks/pre-purge-hook.json',
      '.kiro/hooks/post-resurrection-hook.json',
      '.kiro/powers/aws-exorcist-power.json',
      '.kiro/specs/necroops-spec.json',
      '.kiro/steering/agent-guidelines.md',
      '.gitignore'
    ];
    for (const relativePath of requiredPaths) {
      assert.equal(fs.existsSync(path.join(projectRoot, relativePath)), true, `${relativePath} must exist`);
    }
    assert.equal(fs.existsSync(path.join(projectRoot, '.kiro/agents/hooks/pre-purge-hook.json')), false);
  });

  await t.test('Kiro asset files state their illustrative and unverified boundary', () => {
    const preHook = JSON.parse(fs.readFileSync(path.join(projectRoot, '.kiro/hooks/pre-purge-hook.json'), 'utf8'));
    const postHook = JSON.parse(fs.readFileSync(path.join(projectRoot, '.kiro/hooks/post-resurrection-hook.json'), 'utf8'));
    const spec = JSON.parse(fs.readFileSync(path.join(projectRoot, '.kiro/specs/necroops-spec.json'), 'utf8'));
    const power = JSON.parse(fs.readFileSync(path.join(projectRoot, '.kiro/powers/aws-exorcist-power.json'), 'utf8'));
    const steering = fs.readFileSync(path.join(projectRoot, '.kiro/steering/agent-guidelines.md'), 'utf8');

    assert.equal(preHook.runtimeStatus, 'illustrative-unverified');
    assert.equal(preHook.action.command, 'npm run test:gate');
    assert.equal(postHook.runtimeStatus, 'illustrative-unverified');
    assert.equal(spec.runtimeStatus, 'local-fixture-prototype');
    assert.equal(power.runtimeStatus, 'illustrative-unattached-manifest');
    assert.match(steering, /not automatically injected/i);
  });

  await t.test('dashboard source requests same-origin API state rather than using timer-only success', () => {
    const dashboard = fs.readFileSync(path.join(projectRoot, 'public/index.html'), 'utf8');
    assert.match(dashboard, /fetch\('\/api\/status'\)/);
    assert.match(dashboard, /fetch\('\/api\/kiro-crew\/execute'/);
    assert.match(dashboard, /fetch\('\/api\/reset'/);
    assert.match(dashboard, /Reset Local Fixture Scenario/);
    assert.doesNotMatch(dashboard, /setTimeout\(/);
    assert.match(dashboard, /NO AWS ACCOUNT CONNECTED/);
    assert.match(dashboard, /for this browser demo session/);
    assert.match(dashboard, /const STATUS_COLORS = Object\.freeze/);
    for (const status of ['CRITICAL_HAUNTED', 'EERIE_WARNING', 'LOW_RISK_FIXTURES', 'SANCTIFIED_CLEAN']) {
      assert.match(dashboard, new RegExp(`${status}:`));
    }
    assert.match(dashboard, /riskColor\(telemetry\.status\)/);
    assert.match(dashboard, /function syncWorkflowButton\(availableLabel = 'Run local fixture workflow'\)/);
    assert.match(dashboard, /renderTelemetry\(data\.telemetry\);\s+syncWorkflowButton\(\);/);
    assert.match(dashboard, /clearedTransitionCount/);
    assert.doesNotMatch(dashboard, /local receipt\(s\) cleared/);
    assert.match(dashboard, /main \{[^}]*min-width:0/);
    assert.match(dashboard, /@media\(max-width:400px\).*flex-wrap:wrap/s);
  });

  await t.test('browser-session signing configuration rejects an undersized explicit secret', () => {
    assert.throws(
      () => createServer({ sessionSecret: 'too-short' }),
      /NECROOPS_LOCAL_FIXTURE_SESSION_SECRET must contain at least 32 UTF-8 bytes/
    );
  });

  await t.test('production browser-session server requires an explicit signing secret', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      assert.throws(
        () => createServer(),
        /NECROOPS_LOCAL_FIXTURE_SESSION_SECRET is required in production/
      );
      assert.doesNotThrow(() => createServer({ sessionSecret: 'test-signing-secret-that-is-at-least-32-bytes' }));
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
    }
  });

  await t.test('session-cookie transport keeps local HTTP usable and enforces Secure in production and Vercel without proxy headers', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousVercel = process.env.VERCEL;
    const signingKey = crypto.randomBytes(48);

    const restoreEnvironment = () => {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = previousVercel;
    };

    try {
      process.env.NODE_ENV = 'development';
      delete process.env.VERCEL;
      let localServer = await startBrowserSessionServer({ sessionSecret: signingKey });
      try {
        const localStatus = await request(localServer.baseUrl, '/api/status');
        assert.doesNotMatch(localStatus.response.headers.get('set-cookie') || '', /; Secure/);
      } finally {
        await stopServer(localServer.server);
      }

      process.env.NODE_ENV = 'production';
      delete process.env.VERCEL;
      let productionServer = await startBrowserSessionServer({ sessionSecret: signingKey });
      try {
        const productionStatus = await request(productionServer.baseUrl, '/api/status');
        assert.match(productionStatus.response.headers.get('set-cookie') || '', /; Secure/);
      } finally {
        await stopServer(productionServer.server);
      }

      delete process.env.NODE_ENV;
      process.env.VERCEL = '1';
      let vercelServer = await startBrowserSessionServer({ sessionSecret: signingKey });
      try {
        const vercelStatus = await request(vercelServer.baseUrl, '/api/status');
        assert.match(vercelStatus.response.headers.get('set-cookie') || '', /; Secure/);
      } finally {
        await stopServer(vercelServer.server);
      }
    } finally {
      restoreEnvironment();
    }
  });

  await t.test('HTTP server provides isolated, explicit, same-origin local-fixture API behavior', async () => {
    const { server, baseUrl } = await startIsolatedServer();
    try {
      const status = await request(baseUrl, '/api/status');
      assert.equal(status.response.status, 200);
      assert.equal(status.body.executionMode, 'local-demo-fixtures-no-aws-account');
      assert.equal(status.response.headers.get('access-control-allow-origin'), null);
      assert.equal(status.body.telemetry.suggestedCleanupFixtureId, 'i-0f948a913bc89a712');

      const missingRoute = await request(baseUrl, '/api/missing');
      assert.equal(missingRoute.response.status, 404);
      assert.equal(missingRoute.body.code, 'API_ROUTE_NOT_FOUND');

      const missingTarget = await request(baseUrl, '/api/kiro-crew/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}'
      });
      assert.equal(missingTarget.response.status, 400);
      assert.equal(missingTarget.body.code, 'RESOURCE_ID_REQUIRED');

      const wrongContentType = await request(baseUrl, '/api/exorcise', {
        method: 'POST',
        body: JSON.stringify({ resourceId: 'i-0f948a913bc89a712' })
      });
      assert.equal(wrongContentType.response.status, 415);

      const prefixedButInvalidContentType = await request(baseUrl, '/api/exorcise', {
        method: 'POST',
        headers: { 'content-type': 'application/json-not-a-valid-media-type' },
        body: JSON.stringify({ resourceId: 'i-0f948a913bc89a712' })
      });
      assert.equal(prefixedButInvalidContentType.response.status, 415);
      assert.equal(prefixedButInvalidContentType.body.code, 'UNSUPPORTED_MEDIA_TYPE');

      const malformed = await request(baseUrl, '/api/exorcise', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{bad json'
      });
      assert.equal(malformed.response.status, 400);
      assert.equal(malformed.body.code, 'MALFORMED_JSON');

      const tooLarge = await request(baseUrl, '/api/exorcise', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resourceId: 'i-0f948a913bc89a712', reason: 'x'.repeat(40_000) })
      });
      assert.equal(tooLarge.response.status, 413);
      assert.equal(tooLarge.body.code, 'BODY_TOO_LARGE');

      const workflow = await request(baseUrl, '/api/kiro-crew/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resourceId: 'i-0f948a913bc89a712' })
      });
      assert.equal(workflow.response.status, 200);
      assert.equal(workflow.body.orchestration.status, 'EXORCISED');
      assert.equal(workflow.body.orchestration.mutated, true);
      assert.equal(workflow.body.orchestration.updatedScan.activeZombieCount, 4);
      assert.equal(workflow.body.orchestration.localFixtureReceipt.propertyBasedSafetyGate.trialsPassed, 100);

      const repeatedWorkflow = await request(baseUrl, '/api/kiro-crew/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resourceId: 'i-0f948a913bc89a712' })
      });
      assert.equal(repeatedWorkflow.response.status, 200);
      assert.equal(repeatedWorkflow.body.orchestration.status, 'ALREADY_EXORCISED');
      assert.equal(repeatedWorkflow.body.orchestration.mutated, false);
      assert.equal(repeatedWorkflow.body.orchestration.modeledMonthlyChangeUSD, 0);
      assert.equal(repeatedWorkflow.body.orchestration.localFixtureReceipt, null);
      assert.equal(repeatedWorkflow.body.orchestration.actionsTaken.at(-1).action, 'LOCAL_NO_OP_ALREADY_EXORCISED');

      const resetWrongMethod = await request(baseUrl, '/api/reset');
      assert.equal(resetWrongMethod.response.status, 405);
      assert.equal(resetWrongMethod.response.headers.get('allow'), 'POST, OPTIONS');

      const resetWrongContentType = await request(baseUrl, '/api/reset', { method: 'POST', body: '{}' });
      assert.equal(resetWrongContentType.response.status, 415);
      assert.equal(resetWrongContentType.body.code, 'UNSUPPORTED_MEDIA_TYPE');

      const nonEmptyReset = await request(baseUrl, '/api/reset', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ unexpected: true })
      });
      assert.equal(nonEmptyReset.response.status, 400);
      assert.equal(nonEmptyReset.body.code, 'RESET_BODY_MUST_BE_EMPTY_OBJECT');

      const stateAfterRejectedReset = await request(baseUrl, '/api/status');
      assert.equal(stateAfterRejectedReset.body.telemetry.activeZombieCount, 4);
      assert.equal(stateAfterRejectedReset.body.telemetry.exorcisedCount, 1);

      const resetArray = await request(baseUrl, '/api/reset', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '[]'
      });
      assert.equal(resetArray.response.status, 400);
      assert.equal(resetArray.body.code, 'INVALID_JSON_SHAPE');

      const resetEmptyBody = await request(baseUrl, '/api/reset', {
        method: 'POST', headers: { 'content-type': 'application/json' }
      });
      assert.equal(resetEmptyBody.response.status, 400);
      assert.equal(resetEmptyBody.body.code, 'RESET_BODY_MUST_BE_EMPTY_OBJECT');

      const reset = await request(baseUrl, '/api/reset', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
      });
      assert.equal(reset.response.status, 200);
      assert.equal(reset.body.executionMode, 'local-demo-fixture');
      assert.equal(reset.body.reset.resetFixtureCount, 5);
      assert.equal(reset.body.reset.clearedTransitionCount, 1);
      assert.equal(reset.body.reset.updatedScan.activeZombieCount, 5);
      assert.equal(reset.body.reset.updatedScan.exorcisedCount, 0);
      assert.equal(reset.body.reset.updatedScan.hauntedRiskIndex, 88);
      assert.equal(reset.body.reset.updatedScan.totalMonthlyWasteUSD, 1050);
      assert.equal(reset.body.reset.updatedScan.suggestedCleanupFixtureId, 'i-0f948a913bc89a712');

      const restoredWorkflow = await request(baseUrl, '/api/kiro-crew/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resourceId: 'i-0f948a913bc89a712' })
      });
      assert.equal(restoredWorkflow.response.status, 200);
      assert.equal(restoredWorkflow.body.orchestration.status, 'EXORCISED');
      assert.equal(restoredWorkflow.body.orchestration.mutated, true);
    } finally {
      await stopServer(server);
    }
  });

  await t.test('default HTTP server keeps each browser local-fixture scenario deterministic through an HMAC-signed HttpOnly session cookie', async () => {
    const { server, baseUrl } = await startBrowserSessionServer();
    try {
      const initial = await request(baseUrl, '/api/status');
      let cookie = initial.response.headers.get('set-cookie')?.split(';')[0];
      assert.match(cookie || '', /^necroops_local_fixture_state=/);
      assert.match(cookie || '', /^necroops_local_fixture_state=[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
      assert.match(initial.response.headers.get('set-cookie') || '', /HttpOnly/);
      assert.match(initial.response.headers.get('set-cookie') || '', /SameSite=Lax/);
      assert.equal(initial.body.telemetry.activeZombieCount, 5);
      assert.equal(initial.body.telemetry.hauntedRiskIndex, 88);

      const [cookieName, signedValue] = cookie.split('=');
      const [payload, signature] = signedValue.split('.');
      const changedFinalCharacter = signature.endsWith('A') ? 'B' : 'A';
      const tamperedCookie = `${cookieName}=${payload}.${signature.slice(0, -1)}${changedFinalCharacter}`;
      const tamperedStatus = await request(baseUrl, '/api/status', { headers: { cookie: tamperedCookie } });
      assert.equal(tamperedStatus.body.telemetry.activeZombieCount, 5);
      assert.equal(tamperedStatus.body.telemetry.exorcisedCount, 0);

      const forgedPayload = Buffer.from(JSON.stringify({
        version: 1,
        exorcisedFixtureIds: [
          'i-0f948a913bc89a712',
          'vol-084920491823abf10',
          'arn:aws:lambda:us-east-1:718293019283:function:billing-webhook-v1',
          'vpce-038291048291a8291',
          'rds-cluster-legacy-analytics-store'
        ]
      })).toString('base64url');
      const forgedStatus = await request(baseUrl, '/api/status', {
        headers: { cookie: `${cookieName}=${forgedPayload}.forged-signature` }
      });
      assert.equal(forgedStatus.body.telemetry.activeZombieCount, 5);
      assert.equal(forgedStatus.body.telemetry.exorcisedCount, 0);
      assert.equal(forgedStatus.body.telemetry.hauntedRiskIndex, 88);

      const workflow = await request(baseUrl, '/api/kiro-crew/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ resourceId: 'i-0f948a913bc89a712' })
      });
      cookie = workflow.response.headers.get('set-cookie')?.split(';')[0];
      assert.equal(workflow.body.orchestration.status, 'EXORCISED');
      assert.equal(workflow.body.orchestration.mutated, true);

      const sequentialRetry = await request(baseUrl, '/api/kiro-crew/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ resourceId: 'i-0f948a913bc89a712' })
      });
      cookie = sequentialRetry.response.headers.get('set-cookie')?.split(';')[0];
      assert.equal(sequentialRetry.body.orchestration.status, 'ALREADY_EXORCISED');
      assert.equal(sequentialRetry.body.orchestration.mutated, false);
      assert.equal(sequentialRetry.body.orchestration.localFixtureReceipt, null);

      const persistedStatus = await request(baseUrl, '/api/status', { headers: { cookie } });
      assert.equal(persistedStatus.body.telemetry.activeZombieCount, 4);
      assert.equal(persistedStatus.body.telemetry.exorcisedCount, 1);

      const reset = await request(baseUrl, '/api/reset', {
        method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{}'
      });
      cookie = reset.response.headers.get('set-cookie')?.split(';')[0];
      assert.equal(reset.body.reset.clearedTransitionCount, 1);
      assert.equal(reset.body.reset.updatedScan.activeZombieCount, 5);
      assert.equal(reset.body.reset.updatedScan.hauntedRiskIndex, 88);

      const restoredStatus = await request(baseUrl, '/api/status', { headers: { cookie } });
      assert.equal(restoredStatus.body.telemetry.activeZombieCount, 5);
      assert.equal(restoredStatus.body.telemetry.exorcisedCount, 0);
      assert.equal(restoredStatus.body.telemetry.totalMonthlyWasteUSD, 1050);
    } finally {
      await stopServer(server);
    }
  });

  await t.test('browser-session regression coverage records the disclosed stale-cookie and parallel snapshot limitation', async () => {
    const { server, baseUrl } = await startBrowserSessionServer();
    try {
      const initial = await request(baseUrl, '/api/status');
      const initialCookie = initial.response.headers.get('set-cookie')?.split(';')[0];
      assert.match(initialCookie || '', /^necroops_local_fixture_state=/);

      const workflowRequest = resourceId => request(baseUrl, '/api/kiro-crew/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: initialCookie },
        body: JSON.stringify({ resourceId })
      });

      const [sameFixtureLeft, sameFixtureRight] = await Promise.all([
        workflowRequest('i-0f948a913bc89a712'),
        workflowRequest('i-0f948a913bc89a712')
      ]);
      assert.equal(sameFixtureLeft.body.orchestration.status, 'EXORCISED');
      assert.equal(sameFixtureRight.body.orchestration.status, 'EXORCISED');
      assert.equal(sameFixtureLeft.body.orchestration.mutated, true);
      assert.equal(sameFixtureRight.body.orchestration.mutated, true);
      assert.notEqual(
        sameFixtureLeft.body.orchestration.localFixtureReceipt.receiptId,
        sameFixtureRight.body.orchestration.localFixtureReceipt.receiptId
      );

      const [differentFixtureLeft, differentFixtureRight] = await Promise.all([
        workflowRequest('i-0f948a913bc89a712'),
        workflowRequest('vol-084920491823abf10')
      ]);
      assert.equal(differentFixtureLeft.body.orchestration.updatedScan.activeZombieCount, 4);
      assert.equal(differentFixtureRight.body.orchestration.updatedScan.activeZombieCount, 4);
      assert.equal(
        differentFixtureLeft.body.orchestration.updatedScan.resources.find(resource => resource.id === 'vol-084920491823abf10').status,
        'ORPHANED_GHOST'
      );
      assert.equal(
        differentFixtureRight.body.orchestration.updatedScan.resources.find(resource => resource.id === 'i-0f948a913bc89a712').status,
        'HAUNTED_ZOMBIE'
      );

      const staleSnapshot = await request(baseUrl, '/api/status', { headers: { cookie: initialCookie } });
      assert.equal(staleSnapshot.body.telemetry.activeZombieCount, 5);
      assert.equal(staleSnapshot.body.telemetry.hauntedRiskIndex, 88);

      const readme = fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8');
      const spec = JSON.parse(fs.readFileSync(path.join(projectRoot, '.kiro/specs/necroops-spec.json'), 'utf8'));
      assert.match(readme, /does not transactionally coordinate simultaneous duplicate HTTP submissions/);
      assert.match(readme, /earlier cookie can also replay its own earlier local snapshot/i);
      assert.match(spec.entities.safetyInvariants.find(invariant => invariant.id === 'INV-STATE-01').description, /earlier still-valid cookie can replay/i);
    } finally {
      await stopServer(server);
    }
  });

  await t.test('browser-session cookies use a fixed server-enforced four-hour signed lifetime', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousVercel = process.env.VERCEL;
    const signingKey = crypto.randomBytes(48);
    const startTime = 1_700_000_000_000;
    let currentTime = startTime;

    try {
      process.env.NODE_ENV = 'development';
      delete process.env.VERCEL;
      const { server, baseUrl } = await startBrowserSessionServer({
        sessionSecret: signingKey,
        now: () => currentTime
      });
      try {
        const initial = await request(baseUrl, '/api/status');
        let cookie = initial.response.headers.get('set-cookie')?.split(';')[0];
        const initialSession = sessionPayloadFromSetCookie(initial.response.headers.get('set-cookie'));
        assert.equal(initialSession.version, 2);
        assert.equal(initialSession.issuedAt, Math.floor(startTime / 1000));
        assert.equal(initialSession.expiresAt - initialSession.issuedAt, 4 * 60 * 60);
        assert.match(initial.response.headers.get('set-cookie') || '', /Max-Age=14400/);

        const workflow = await request(baseUrl, '/api/kiro-crew/execute', {
          method: 'POST',
          headers: { 'content-type': 'application/json', cookie },
          body: JSON.stringify({ resourceId: 'i-0f948a913bc89a712' })
        });
        cookie = workflow.response.headers.get('set-cookie')?.split(';')[0];
        assert.equal(workflow.body.orchestration.status, 'EXORCISED');

        currentTime = startTime + (60 * 60 * 1000);
        const restored = await request(baseUrl, '/api/status', { headers: { cookie } });
        cookie = restored.response.headers.get('set-cookie')?.split(';')[0];
        const preservedSession = sessionPayloadFromSetCookie(restored.response.headers.get('set-cookie'));
        assert.equal(restored.body.telemetry.activeZombieCount, 4);
        assert.equal(preservedSession.issuedAt, initialSession.issuedAt);
        assert.equal(preservedSession.expiresAt, initialSession.expiresAt);
        assert.match(restored.response.headers.get('set-cookie') || '', /Max-Age=10800/);

        currentTime = startTime + (4 * 60 * 60 * 1000) + 1;
        const expired = await request(baseUrl, '/api/status', { headers: { cookie } });
        assert.equal(expired.body.telemetry.activeZombieCount, 5);
        assert.equal(expired.body.telemetry.exorcisedCount, 0);
        const freshSession = sessionPayloadFromSetCookie(expired.response.headers.get('set-cookie'));
        assert.equal(freshSession.version, 2);
        assert.equal(freshSession.issuedAt, Math.floor(currentTime / 1000));
        assert.equal(freshSession.expiresAt - freshSession.issuedAt, 4 * 60 * 60);
        assert.match(expired.response.headers.get('set-cookie') || '', /Max-Age=14400/);

        const invalidTemporalPayloads = [
          {
            version: 2,
            issuedAt: Math.floor(currentTime / 1000),
            expiresAt: Math.floor(currentTime / 1000),
            exorcisedFixtureIds: ['i-0f948a913bc89a712']
          },
          {
            version: 2,
            issuedAt: 'not-a-timestamp',
            expiresAt: Math.floor(currentTime / 1000) + (4 * 60 * 60),
            exorcisedFixtureIds: ['i-0f948a913bc89a712']
          }
        ];
        for (const payload of invalidTemporalPayloads) {
          const invalidTemporal = await request(baseUrl, '/api/status', {
            headers: { cookie: signedSessionCookie(payload, signingKey) }
          });
          assert.equal(invalidTemporal.body.telemetry.activeZombieCount, 5);
          assert.equal(invalidTemporal.body.telemetry.exorcisedCount, 0);
        }

        const legacyCookie = signedSessionCookie({
          version: 1,
          exorcisedFixtureIds: ['i-0f948a913bc89a712']
        }, signingKey);
        const legacy = await request(baseUrl, '/api/status', { headers: { cookie: legacyCookie } });
        assert.equal(legacy.body.telemetry.activeZombieCount, 5);
        assert.equal(legacy.body.telemetry.exorcisedCount, 0);
        assert.equal(sessionPayloadFromSetCookie(legacy.response.headers.get('set-cookie')).version, 2);
      } finally {
        await stopServer(server);
      }
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousVercel === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = previousVercel;
    }
  });

  await t.test('Vercel catch-all adapter preserves root, reset, and browser-session fixture behavior', async () => {
    const { server, baseUrl } = await startVercelAdapterServer();
    const httpsHeaders = { 'x-forwarded-proto': 'https' };
    try {
      const root = await request(baseUrl, '/', { headers: httpsHeaders });
      assert.equal(root.response.status, 200);
      assert.match(root.body, /Reset Local Fixture Scenario/);

      const initial = await request(baseUrl, '/api/status', { headers: httpsHeaders });
      let cookie = initial.response.headers.get('set-cookie')?.split(';')[0];
      assert.equal(initial.response.status, 200);
      assert.equal(initial.body.telemetry.activeZombieCount, 5);
      assert.match(initial.response.headers.get('set-cookie') || '', /Secure/);

      const workflow = await request(baseUrl, '/api/kiro-crew/execute', {
        method: 'POST',
        headers: { ...httpsHeaders, 'content-type': 'application/json', cookie },
        body: JSON.stringify({ resourceId: 'i-0f948a913bc89a712' })
      });
      cookie = workflow.response.headers.get('set-cookie')?.split(';')[0];
      assert.equal(workflow.body.orchestration.status, 'EXORCISED');

      const reset = await request(baseUrl, '/api/reset', {
        method: 'POST',
        headers: { ...httpsHeaders, 'content-type': 'application/json', cookie }, body: '{}'
      });
      cookie = reset.response.headers.get('set-cookie')?.split(';')[0];
      assert.equal(reset.response.status, 200);
      assert.equal(reset.body.reset.updatedScan.hauntedRiskIndex, 88);
      assert.equal(reset.body.reset.updatedScan.totalMonthlyWasteUSD, 1050);

      const restored = await request(baseUrl, '/api/status', { headers: { ...httpsHeaders, cookie } });
      assert.equal(restored.body.telemetry.activeZombieCount, 5);
      assert.equal(restored.body.telemetry.exorcisedCount, 0);
    } finally {
      await stopServer(server);
    }
  });

  await t.test('HTTP server validates supported routes, methods, static responses, and engine errors', async () => {
    const { server, baseUrl } = await startIsolatedServer();
    try {
      const options = await request(baseUrl, '/api/status', { method: 'OPTIONS' });
      assert.equal(options.response.status, 204);
      assert.equal(options.response.headers.get('allow'), 'GET, POST, OPTIONS');

      const queryStatus = await request(baseUrl, '/api/status?ignored=1');
      assert.equal(queryStatus.response.status, 200);
      assert.equal(queryStatus.response.headers.get('cache-control'), 'no-store');
      assert.equal(queryStatus.response.headers.get('x-content-type-options'), 'nosniff');

      const wrongStatusMethod = await request(baseUrl, '/api/status', { method: 'POST' });
      assert.equal(wrongStatusMethod.response.status, 405);
      assert.equal(wrongStatusMethod.response.headers.get('allow'), 'GET, OPTIONS');

      const scan = await request(baseUrl, '/api/scan');
      assert.equal(scan.response.status, 200);
      assert.equal(scan.body.executionMode, 'local-demo-fixture');

      const resurrected = await request(baseUrl, '/api/resurrect', {
        method: 'POST',
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ resourceId: 'i-0f948a913bc89a712' })
      });
      assert.equal(resurrected.response.status, 200);
      assert.equal(resurrected.body.result.deploymentStatus, 'not-deployed');

      const noCode = await request(baseUrl, '/api/resurrect', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resourceId: 'vol-084920491823abf10' })
      });
      assert.equal(noCode.response.status, 409);
      assert.equal(noCode.body.code, 'NO_LEGACY_CODE');

      const invalidShape = await request(baseUrl, '/api/exorcise', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '[]'
      });
      assert.equal(invalidShape.response.status, 400);
      assert.equal(invalidShape.body.code, 'INVALID_JSON_SHAPE');

      const invalidReason = await request(baseUrl, '/api/exorcise', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resourceId: 'vol-084920491823abf10', reason: '   ' })
      });
      assert.equal(invalidReason.response.status, 400);
      assert.equal(invalidReason.body.code, 'INVALID_REASON');

      const directCleanup = await request(baseUrl, '/api/exorcise', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resourceId: 'vol-084920491823abf10', reason: 'Local test cleanup' })
      });
      assert.equal(directCleanup.response.status, 200);
      assert.equal(directCleanup.body.receipt.propertyBasedSafetyGate.trialsPassed, 100);

      const idempotentCleanup = await request(baseUrl, '/api/exorcise', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resourceId: 'vol-084920491823abf10' })
      });
      assert.equal(idempotentCleanup.response.status, 200);
      assert.equal(idempotentCleanup.body.receipt.status, 'ALREADY_EXORCISED');

      const unknownFixture = await request(baseUrl, '/api/exorcise', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ resourceId: 'not-a-fixture' })
      });
      assert.equal(unknownFixture.response.status, 404);
      assert.equal(unknownFixture.body.code, 'RESOURCE_NOT_FOUND');

      const root = await request(baseUrl, '/');
      assert.equal(root.response.status, 200);
      assert.match(root.body, /LOCAL DEMO FIXTURES/);
      const missingStatic = await request(baseUrl, '/not-a-dashboard-file');
      assert.equal(missingStatic.response.status, 404);
      assert.equal(missingStatic.body, 'Not found.');
    } finally {
      await stopServer(server);
    }

    const absentPublicDir = path.join(projectRoot, 'not-a-public-directory');
    const { server: missingAssetServer, baseUrl: missingAssetBaseUrl } = await startIsolatedServer({ publicDir: absentPublicDir });
    try {
      const missingAsset = await request(missingAssetBaseUrl, '/');
      assert.equal(missingAsset.response.status, 500);
      assert.equal(missingAsset.body, 'Dashboard asset is missing.');
    } finally {
      await stopServer(missingAssetServer);
    }

    const { server: brokenEngineServer, baseUrl: brokenEngineBaseUrl } = await startIsolatedServer({
      engine: { scanCloudPerimeter() { throw new Error('Local test engine failure.'); } }
    });
    try {
      const brokenStatus = await request(brokenEngineBaseUrl, '/api/status');
      assert.equal(brokenStatus.response.status, 500);
      assert.equal(brokenStatus.body.code, 'INTERNAL_ERROR');
      assert.equal(brokenStatus.body.error, 'Unexpected local server error.');
    } finally {
      await stopServer(brokenEngineServer);
    }
  });
});

