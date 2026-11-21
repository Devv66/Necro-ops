import crypto from 'node:crypto';

/**
 * NecroOps local-fixture engine.
 *
 * This module never connects to AWS or a Kiro runtime. The catalog, risk scores,
 * costs, code samples, receipts, and state changes are all local demo fixtures.
 */

export const ZOMBIE_CATALOG = [
  {
    id: 'i-0f948a913bc89a712',
    name: 'legacy-payment-monolith-worker',
    type: 'EC2 Instance (m5.2xlarge)',
    region: 'us-east-1',
    costMonthly: 480.00,
    idleDays: 284,
    cpuAvgPercent: 0.38,
    memoryLeakObserved: true,
    lastAccessedBy: 'unknown-former-employee',
    status: 'HAUNTED_ZOMBIE',
    riskLevel: 'CRITICAL',
    legacyCode: `// Local fixture: deprecated CommonJS payment-worker example
function processLegacyPayment(req, res) {
  var rawData = req.body;
  if (!rawData || !rawData.amount) return res.status(400).send('Invalid amount');
  var fee = rawData.amount * 0.029 + 0.30;
  var net = rawData.amount - fee;
  if (!global.auditCache) global.auditCache = [];
  global.auditCache.push(rawData);
  return res.json({ success: true, net: net, fee: fee });
}`
  },
  {
    id: 'vol-084920491823abf10',
    name: 'orphaned-prod-backup-snap-2024',
    type: 'EBS Volume (gp3 1.5TB)',
    region: 'us-east-1',
    costMonthly: 150.00,
    idleDays: 412,
    cpuAvgPercent: 0.0,
    memoryLeakObserved: false,
    lastAccessedBy: 'system-snapshot-automation',
    status: 'ORPHANED_GHOST',
    riskLevel: 'HIGH',
    legacyCode: null
  },
  {
    id: 'arn:aws:lambda:us-east-1:718293019283:function:billing-webhook-v1',
    name: 'billing-webhook-v1-deprecated',
    type: 'AWS Lambda (Node.js 12.x End-of-Life)',
    region: 'us-east-1',
    costMonthly: 65.00,
    idleDays: 198,
    cpuAvgPercent: 0.05,
    memoryLeakObserved: true,
    lastAccessedBy: 'stripe-v1-deprecated-webhook',
    status: 'DEPRECATED_ZOMBIE',
    riskLevel: 'HIGH',
    legacyCode: `// Local fixture: legacy billing webhook example
exports.handler = function(event, context, callback) {
  var payload = JSON.parse(event.body || '{}');
  if (!payload.token) return callback(new Error('Missing token'));
  var processed = 'TX_' + Math.random().toString(36).substr(2, 9);
  callback(null, { statusCode: 200, body: JSON.stringify({ txId: processed, status: 'PROCESSED' }) });
};`
  },
  {
    id: 'vpce-038291048291a8291',
    name: 'stale-internal-microservice-vpce',
    type: 'VPC Endpoint (Privatelink)',
    region: 'us-east-1',
    costMonthly: 45.00,
    idleDays: 182,
    cpuAvgPercent: 0.0,
    memoryLeakObserved: false,
    lastAccessedBy: 'decommissioned-service',
    status: 'UNROUTED_PHANTOM',
    riskLevel: 'MEDIUM',
    legacyCode: null
  },
  {
    id: 'rds-cluster-legacy-analytics-store',
    name: 'abandoned-analytics-mysql56',
    type: 'RDS Aurora MySQL (v5.6 Obsolete)',
    region: 'us-east-1',
    costMonthly: 310.00,
    idleDays: 320,
    cpuAvgPercent: 0.12,
    memoryLeakObserved: false,
    lastAccessedBy: 'legacy-bi-dashboard',
    status: 'HAUNTED_ZOMBIE',
    riskLevel: 'CRITICAL',
    legacyCode: null
  }
];

const RISK_PRIORITY = Object.freeze({ CRITICAL: 3, HIGH: 2, MEDIUM: 1, SAFE: 0 });
const FEE_RATE_BASIS_POINTS = 290;
const MODERN_FEE_NUMERATOR = 29n;
const MODERN_FEE_DENOMINATOR = 1_000n;
const FIXED_FEE_CENTS = 30;
const MINIMUM_SETTLEABLE_AMOUNT_CENTS = 32;
// The local property-test domain is deliberately bounded to $15,000.00.
const MAXIMUM_SETTLEABLE_AMOUNT_CENTS = 1_500_000;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function engineError(message, code, statusCode) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function centsToUsd(cents) {
  return Number((cents / 100).toFixed(2));
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/**
 * Reject values that would make JavaScript number arithmetic ambiguous before
 * either local fee implementation is evaluated.
 */
function requireSafeFixtureCents(amountCents) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0 || amountCents > MAXIMUM_SETTLEABLE_AMOUNT_CENTS) {
    throw new RangeError(`amountCents must be a safe integer from 0 to ${MAXIMUM_SETTLEABLE_AMOUNT_CENTS}.`);
  }
}

/**
 * The fixture's documented legacy fee rule, expressed in integer cents.
 */
export function calculateLegacyFixturePayment(amountCents) {
  requireSafeFixtureCents(amountCents);
  const feeCents = Math.round((amountCents * FEE_RATE_BASIS_POINTS) / 10_000) + FIXED_FEE_CENTS;
  return { feeCents, netCents: amountCents - feeCents };
}

/**
 * Independent local-modern fee oracle. It uses exact BigInt rational arithmetic
 * rather than the legacy floating-point basis-point expression.
 */
export function calculateModernFixturePayment(amountCents) {
  requireSafeFixtureCents(amountCents);
  const variableFeeCents = Number((BigInt(amountCents) * MODERN_FEE_NUMERATOR + 500n) / MODERN_FEE_DENOMINATOR);
  const feeCents = variableFeeCents + FIXED_FEE_CENTS;
  return { feeCents, netCents: amountCents - feeCents };
}

export function verifyFixtureReceipt(receipt) {
  if (!receipt || typeof receipt !== 'object' || typeof receipt.receiptDigestSha256 !== 'string') return false;
  const { receiptDigestSha256, ...unsignedReceipt } = receipt;
  return sha256(canonicalize(unsignedReceipt)) === receiptDigestSha256;
}

function paymentModernExample() {
  return `// Local JavaScript example only — not deployed to AWS.
export async function handler(event) {
  const payload = JSON.parse(event.body || '{}');
  const amountCents = Math.round(Number(payload.amount) * 100);
  if (!Number.isInteger(amountCents) || amountCents < 32) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Amount must cover the fixture fee.' }) };
  }
  const variableFeeCents = Math.floor((amountCents * 29 + 500) / 1000);
  const feeCents = variableFeeCents + 30;
  const netCents = amountCents - feeCents;
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true, fee: feeCents / 100, net: netCents / 100 })
  };
}`;
}

function billingWebhookModernExample() {
  return `// Local JavaScript example only — not deployed to AWS.
export async function handler(event) {
  const payload = JSON.parse(event.body || '{}');
  if (typeof payload.token !== 'string' || payload.token.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing token' }) };
  }
  const fixtureTransactionId = 'FIXTURE_TX_' + payload.token.slice(-6);
  return {
    statusCode: 200,
    body: JSON.stringify({ transactionId: fixtureTransactionId, status: 'PROCESSED_IN_LOCAL_DEMO' })
  };
}`;
}

export class NecroOpsEngine {
  constructor() {
    this.zombies = clone(ZOMBIE_CATALOG);
    this.exorcisedLog = [];
  }

  /**
   * Restore only this engine instance's local demo scenario. This deliberately
   * has no cloud side effect, accepts no external fixture data, and clears
   * only simulated receipts held in this process's memory.
   */
  resetLocalFixtureScenario() {
    const clearedReceiptCount = this.exorcisedLog.length;
    this.zombies = clone(ZOMBIE_CATALOG);
    this.exorcisedLog = [];
    const updatedScan = this.scanCloudPerimeter();

    return {
      executionMode: 'local-demo-fixture',
      resetAt: new Date().toISOString(),
      resetFixtureCount: this.zombies.length,
      clearedReceiptCount,
      message: 'Restored the five local demo fixtures to their initial in-memory scenario. No AWS resource was changed.',
      updatedScan
    };
  }

  /**
   * The public demo stores only the IDs of simulated transitions in a browser
   * session cookie. No fixture content, receipt, credential, or cloud data is
   * accepted from that cookie.
   */
  exportLocalFixtureSession() {
    return {
      version: 1,
      exorcisedFixtureIds: this.zombies
        .filter(zombie => zombie.status === 'EXORCISED')
        .map(zombie => zombie.id)
        .sort()
    };
  }

  restoreLocalFixtureSession(session) {
    if (!session || typeof session !== 'object' || session.version !== 1 || !Array.isArray(session.exorcisedFixtureIds)) {
      return false;
    }

    const permittedIds = new Set(ZOMBIE_CATALOG.map(zombie => zombie.id));
    const uniqueIds = [...new Set(session.exorcisedFixtureIds)];
    if (uniqueIds.length !== session.exorcisedFixtureIds.length || uniqueIds.some(id => typeof id !== 'string' || !permittedIds.has(id))) {
      return false;
    }

    this.zombies = clone(ZOMBIE_CATALOG);
    this.exorcisedLog = [];
    for (const resourceId of uniqueIds) {
      const resource = this.getResource(resourceId);
      resource.status = 'EXORCISED';
      resource.riskLevel = 'SAFE';
      // A session restores only the simulated transition count, not a receipt.
      this.exorcisedLog.push({ resourceId, restoredFromLocalFixtureSession: true });
    }
    return true;
  }

  getResource(resourceId) {
    const resource = this.zombies.find(zombie => zombie.id === resourceId);
    if (!resource) {
      throw engineError(`Fixture resource ${resourceId} was not found in the local catalog.`, 'RESOURCE_NOT_FOUND', 404);
    }
    return resource;
  }

  getCleanupCandidates() {
    return this.zombies
      .filter(zombie => zombie.status !== 'EXORCISED')
      .slice()
      .sort((left, right) => {
        const riskDifference = RISK_PRIORITY[right.riskLevel] - RISK_PRIORITY[left.riskLevel];
        if (riskDifference !== 0) return riskDifference;
        const costDifference = right.costMonthly - left.costMonthly;
        if (costDifference !== 0) return costDifference;
        return left.id.localeCompare(right.id);
      })
      .map(clone);
  }

  scanCloudPerimeter() {
    let totalWaste = 0;
    let criticalCount = 0;
    let activeZombies = 0;

    for (const zombie of this.zombies) {
      if (zombie.status !== 'EXORCISED') {
        totalWaste += zombie.costMonthly;
        activeZombies += 1;
        if (zombie.riskLevel === 'CRITICAL') criticalCount += 1;
      }
    }

    const score = activeZombies === 0
      ? 0
      : Math.min(100, Math.max(0, Math.round(activeZombies * 14 + criticalCount * 9)));

    return {
      executionMode: 'local-demo-fixture',
      scannedAt: new Date().toISOString(),
      hauntedRiskIndex: score,
      status: score > 70 ? 'CRITICAL_HAUNTED' : (score > 30 ? 'EERIE_WARNING' : 'SANCTIFIED_CLEAN'),
      totalMonthlyWasteUSD: Number(totalWaste.toFixed(2)),
      annualWasteProjectionUSD: Number((totalWaste * 12).toFixed(2)),
      activeZombieCount: activeZombies,
      exorcisedCount: this.exorcisedLog.length,
      suggestedCleanupFixtureId: this.getCleanupCandidates()[0]?.id ?? null,
      resources: clone(this.zombies)
    };
  }

  resurrectLegacyCode(resourceId) {
    const resource = this.getResource(resourceId);
    if (!resource.legacyCode) {
      throw engineError(`Fixture resource ${resourceId} has no supplied legacy-code example.`, 'NO_LEGACY_CODE', 409);
    }

    const isPaymentWorker = resource.id === 'i-0f948a913bc89a712';
    return {
      executionMode: 'local-demo-fixture',
      resourceId: resource.id,
      resourceName: resource.name,
      exampleLanguage: 'JavaScript',
      deploymentStatus: 'not-deployed',
      memoryLeakPatternDiscussed: isPaymentWorker,
      modernizedExample: isPaymentWorker ? paymentModernExample() : billingWebhookModernExample(),
      generatedAt: new Date().toISOString(),
      note: 'This is a fixture-specific example generated locally. It is not a verified AST transformation or deployed Lambda.'
    };
  }

  verifyPropertyBasedInvariants(inputPayload) {
    const amount = inputPayload?.amount;
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return { valid: false, reason: 'Input amount must be a positive finite number.', input: amount };
    }

    const rawCents = amount * 100;
    const amountCents = Math.round(rawCents);
    if (!Number.isSafeInteger(amountCents) || amountCents > MAXIMUM_SETTLEABLE_AMOUNT_CENTS) {
      return {
        valid: false,
        reason: `Input amount must resolve to a safe integer-cent value no greater than ${centsToUsd(MAXIMUM_SETTLEABLE_AMOUNT_CENTS)}.`,
        input: amount
      };
    }
    if (Math.abs(rawCents - amountCents) > 0.000001) {
      return { valid: false, reason: 'Input amount must have no more than two decimal places.', input: amount };
    }

    const legacy = calculateLegacyFixturePayment(amountCents);
    const modern = calculateModernFixturePayment(amountCents);
    if (amountCents < MINIMUM_SETTLEABLE_AMOUNT_CENTS || legacy.netCents < 0) {
      return {
        valid: false,
        reason: 'Input amount must leave at least one net cent after the fixture fee rule.',
        inputAmount: amount,
        inputAmountCents: amountCents,
        calculatedFee: centsToUsd(legacy.feeCents),
        calculatedNet: centsToUsd(legacy.netCents)
      };
    }

    const equivalent = legacy.feeCents === modern.feeCents && legacy.netCents === modern.netCents;
    const conserved = modern.netCents + modern.feeCents === amountCents;
    const valid = equivalent && conserved;

    return {
      valid,
      inputAmount: centsToUsd(amountCents),
      inputAmountCents: amountCents,
      calculatedFee: centsToUsd(modern.feeCents),
      calculatedFeeCents: modern.feeCents,
      calculatedNet: centsToUsd(modern.netCents),
      calculatedNetCents: modern.netCents,
      sumCheck: centsToUsd(modern.netCents + modern.feeCents),
      sumCheckCents: modern.netCents + modern.feeCents,
      legacyAndExampleEquivalent: equivalent,
      moneyConserved: conserved,
      invariantChecksum: sha256(`${amountCents}:${modern.feeCents}:${modern.netCents}`)
    };
  }

  runPropertyBasedTests(trialCount = 100, seed = 0x4e454352) {
    if (!Number.isInteger(trialCount) || trialCount < 1 || trialCount > 10_000) {
      throw engineError('trialCount must be an integer between 1 and 10000.', 'INVALID_TRIAL_COUNT', 400);
    }

    const random = seededRandom(seed);
    const trials = [];
    const failures = [];
    const minimum = MINIMUM_SETTLEABLE_AMOUNT_CENTS;
    const maximum = MAXIMUM_SETTLEABLE_AMOUNT_CENTS;

    for (let index = 0; index < trialCount; index += 1) {
      const amountCents = minimum + Math.floor(random() * (maximum - minimum + 1));
      const result = this.verifyPropertyBasedInvariants({ amount: centsToUsd(amountCents) });
      const record = { trial: index + 1, amountCents, valid: result.valid };
      trials.push(record);
      if (!result.valid) failures.push({ ...record, error: result.reason });
    }

    return {
      executionMode: 'local-demo-fixture',
      property: 'Fixture legacy and local example fee calculations agree, and integer-cent net plus fee equals gross amount.',
      randomization: 'seeded-linear-congruential-generator',
      seed,
      trialsRequested: trialCount,
      trialsPassed: trialCount - failures.length,
      passed: failures.length === 0,
      failures,
      trialSummary: trials
    };
  }

  exorciseZombieResource(resourceId, reason = 'Local fixture property-based safety gate passed.') {
    const resource = this.getResource(resourceId);
    if (resource.status === 'EXORCISED') {
      return {
        status: 'ALREADY_EXORCISED',
        executionMode: 'local-demo-fixture',
        message: `Fixture ${resource.name} is already in the simulated cleaned state.`,
        resourceId: resource.id
      };
    }

    const safetyGate = this.runPropertyBasedTests(100);
    if (!safetyGate.passed) {
      throw engineError(
        `Local property-based safety gate failed: ${safetyGate.failures.length} trial(s) did not satisfy the fixture property.`,
        'SAFETY_GATE_FAILED',
        422
      );
    }

    // This changes only this process's in-memory local fixture state.
    resource.status = 'EXORCISED';
    resource.riskLevel = 'SAFE';

    const exorcisedAt = new Date().toISOString();
    const unsignedReceipt = {
      receiptId: `LOCAL-FIXTURE-RECEIPT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      resourceId: resource.id,
      resourceName: resource.name,
      modeledMonthlyChangeUSD: resource.costMonthly,
      exorcisedAt,
      executionMode: 'local-demo-fixture',
      operator: 'local-fixture-simulator',
      propertyBasedSafetyGate: {
        trialsRequested: safetyGate.trialsRequested,
        trialsPassed: safetyGate.trialsPassed,
        passed: safetyGate.passed,
        seed: safetyGate.seed
      },
      reason
    };
    const receipt = { ...unsignedReceipt, receiptDigestSha256: sha256(canonicalize(unsignedReceipt)) };

    this.exorcisedLog.push(clone(receipt));
    return receipt;
  }

  runKiroCrewOrchestration(resourceId) {
    if (typeof resourceId !== 'string' || resourceId.trim() === '') {
      throw engineError('An explicit fixture resourceId is required for local workflow simulation.', 'RESOURCE_ID_REQUIRED', 400);
    }

    const target = this.getResource(resourceId);
    const actionsTaken = [{
      roleAsset: 'Reaper',
      action: 'LOCAL_FIXTURE_SELECTED',
      target: target.id,
      detail: 'Selected an explicit resource from the in-memory fixture catalog. No cloud inventory query occurred.'
    }];

    // A retry must be an explicit no-op: it must not claim a new state change,
    // rerun the safety gate, recreate a receipt, or report prior savings again.
    if (target.status === 'EXORCISED') {
      const updatedScan = this.scanCloudPerimeter();
      actionsTaken.push({
        roleAsset: 'Exorcist',
        action: 'LOCAL_NO_OP_ALREADY_EXORCISED',
        target: target.id,
        detail: 'No local state transition was performed. This fixture was already exorcised; no safety gate or new receipt was created.'
      });
      return {
        status: 'ALREADY_EXORCISED',
        mutated: false,
        executionMode: 'local-demo-fixture',
        workflowSessionId: `LOCAL-SIM-${Date.now()}`,
        orchestrationTime: new Date().toISOString(),
        roleAssetsReferenced: ['Reaper', 'Exorcist'],
        actionsTaken,
        resurrectionSummary: null,
        localFixtureReceipt: null,
        remainingRiskIndex: updatedScan.hauntedRiskIndex,
        modeledMonthlyChangeUSD: 0,
        updatedScan
      };
    }

    let resurrectionSummary = null;
    if (target.legacyCode) {
      resurrectionSummary = this.resurrectLegacyCode(target.id);
      actionsTaken.push({
        roleAsset: 'Necromancer',
        action: 'LOCAL_EXAMPLE_PREPARED',
        target: target.id,
        detail: 'Prepared a fixture-specific JavaScript example. No AST service, Kiro runtime, or Lambda deployment occurred.'
      });
    }

    const receipt = this.exorciseZombieResource(target.id, 'Local fixture gate passed; in-memory state transition simulated.');
    actionsTaken.push({
      roleAsset: 'Exorcist',
      action: 'LOCAL_STATE_TRANSITION',
      target: target.id,
      detail: `Simulated in-memory cleanup. Modeled monthly change: $${target.costMonthly.toFixed(2)}. No AWS resource was changed.`
    });

    const updatedScan = this.scanCloudPerimeter();
    return {
      status: 'EXORCISED',
      mutated: true,
      executionMode: 'local-demo-fixture',
      workflowSessionId: `LOCAL-SIM-${Date.now()}`,
      orchestrationTime: new Date().toISOString(),
      roleAssetsReferenced: ['Reaper', 'Necromancer', 'Exorcist'],
      actionsTaken,
      resurrectionSummary,
      localFixtureReceipt: receipt,
      remainingRiskIndex: updatedScan.hauntedRiskIndex,
      modeledMonthlyChangeUSD: receipt.modeledMonthlyChangeUSD,
      updatedScan
    };
  }
}
