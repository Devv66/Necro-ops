import { NecroOpsEngine } from '../src/engine.js';

// The cleanup gate is exhaustive over the configured integer-cent domain; it accepts no sampling-count options.
const result = new NecroOpsEngine().runExhaustiveFixtureSafetyGate();
console.log(JSON.stringify({
  executionMode: result.executionMode,
  passed: result.passed,
  verificationMethod: result.verificationMethod,
  domainMinimumCents: result.domainMinimumCents,
  domainMaximumCents: result.domainMaximumCents,
  domainValuesChecked: result.domainValuesChecked,
  trialsRequested: result.trialsRequested,
  trialsPassed: result.trialsPassed,
  property: result.property
}, null, 2));

process.exit(result.passed ? 0 : 1);
