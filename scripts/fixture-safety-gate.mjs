import { NecroOpsEngine } from '../src/engine.js';

const argument = process.argv.find(value => value.startsWith('--trials='));
const trials = argument ? Number(argument.slice('--trials='.length)) : 100;

if (!Number.isInteger(trials) || trials < 1 || trials > 10_000) {
  console.error('Usage: node scripts/fixture-safety-gate.mjs --trials=<integer 1..10000>');
  process.exit(2);
}

const result = new NecroOpsEngine().runPropertyBasedTests(trials);
console.log(JSON.stringify({
  executionMode: result.executionMode,
  passed: result.passed,
  trialsRequested: result.trialsRequested,
  trialsPassed: result.trialsPassed,
  seed: result.seed,
  property: result.property
}, null, 2));

process.exit(result.passed ? 0 : 1);
