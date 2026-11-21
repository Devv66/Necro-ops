import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  calculateLegacyFixturePayment,
  calculateModernFixturePayment,
  NecroOpsEngine,
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

  await t.test('cleanup is idempotent within one process', () => {
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
    assert.equal(reset.clearedReceiptCount, 2);
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

  await t.test('orchestration reports a truthful, zero-change idempotent retry', () => {
    assert.throws(() => engine.runKiroCrewOrchestration(), { code: 'RESOURCE_ID_REQUIRED' });
    const workflow = engine.runKiroCrewOrchestration('i-0f948a913bc89a712');
    assert.equal(workflow.status, 'EXORCISED');
    assert.equal(workflow.mutated, true);
    assert.equal(workflow.executionMode, 'local-demo-fixture');
    assert.equal(workflow.actionsTaken.length, 3);
    assert.equal(workflow.updatedScan.activeZombieCount, 4);
    assert.equal(workflow.updatedScan.hauntedRiskIndex, 65);
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

      const reset = await request(baseUrl, '/api/reset', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
      });
      assert.equal(reset.response.status, 200);
      assert.equal(reset.body.executionMode, 'local-demo-fixture');
      assert.equal(reset.body.reset.resetFixtureCount, 5);
      assert.equal(reset.body.reset.clearedReceiptCount, 1);
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

  await t.test('default HTTP server keeps each browser local-fixture scenario deterministic through a validated HttpOnly session cookie', async () => {
    const { server, baseUrl } = await startBrowserSessionServer();
    try {
      const initial = await request(baseUrl, '/api/status');
      let cookie = initial.response.headers.get('set-cookie')?.split(';')[0];
      assert.match(cookie || '', /^necroops_local_fixture_state=/);
      assert.match(initial.response.headers.get('set-cookie') || '', /HttpOnly/);
      assert.match(initial.response.headers.get('set-cookie') || '', /SameSite=Lax/);
      assert.equal(initial.body.telemetry.activeZombieCount, 5);
      assert.equal(initial.body.telemetry.hauntedRiskIndex, 88);

      const workflow = await request(baseUrl, '/api/kiro-crew/execute', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ resourceId: 'i-0f948a913bc89a712' })
      });
      cookie = workflow.response.headers.get('set-cookie')?.split(';')[0];
      assert.equal(workflow.body.orchestration.status, 'EXORCISED');

      const persistedStatus = await request(baseUrl, '/api/status', { headers: { cookie } });
      assert.equal(persistedStatus.body.telemetry.activeZombieCount, 4);
      assert.equal(persistedStatus.body.telemetry.exorcisedCount, 1);

      const reset = await request(baseUrl, '/api/reset', {
        method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{}'
      });
      cookie = reset.response.headers.get('set-cookie')?.split(';')[0];
      assert.equal(reset.body.reset.clearedReceiptCount, 1);
      assert.equal(reset.body.reset.updatedScan.activeZombieCount, 5);
      assert.equal(reset.body.reset.updatedScan.hauntedRiskIndex, 88);

      const restoredStatus = await request(baseUrl, '/api/status', { headers: { cookie } });
      assert.equal(restoredStatus.body.telemetry.activeZombieCount, 5);
      assert.equal(restoredStatus.body.telemetry.exorcisedCount, 0);
      assert.equal(restoredStatus.body.telemetry.totalMonthlyWasteUSD, 1050);

      const invalidCookie = await request(baseUrl, '/api/status', { headers: { cookie: 'necroops_local_fixture_state=not-valid-json' } });
      assert.equal(invalidCookie.body.telemetry.activeZombieCount, 5);
      assert.match(invalidCookie.response.headers.get('set-cookie') || '', /^necroops_local_fixture_state=/);
    } finally {
      await stopServer(server);
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

