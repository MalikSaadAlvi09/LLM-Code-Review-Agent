import { strictEqual, ok } from 'node:assert';
import {
  computeSourceHash,
  createPatchInfo,
  applyPatch,
  undoPatch
} from '../src/lib/patchManager';

console.log('🧪 Starting Patch Manager Tests...');

const originalSource = `def process_charge(customer: dict):
    # Bug: Unhandled NoneType
    stripe_id = customer.get("metadata")["stripe_id"]
    return stripe_id
`;

// 1. Create Patch
const patch = createPatchInfo(
  'payment.py',
  3,
  3,
  '    stripe_id = customer.get("metadata")["stripe_id"]',
  '    stripe_id = (customer.get("metadata") or {}).get("stripe_id")',
  originalSource
);

strictEqual(patch.status, 'suggested');
ok(patch.diff.includes('-    stripe_id = customer.get("metadata")["stripe_id"]'));
ok(patch.diff.includes('+    stripe_id = (customer.get("metadata") or {}).get("stripe_id")'));

// 2. Apply Patch
const applyResult = applyPatch(originalSource, patch, 3, 3);
ok(applyResult.success, 'Patch application should succeed');
strictEqual(applyResult.patch.status, 'applied');
ok(applyResult.updatedSource.includes('(customer.get("metadata") or {}).get("stripe_id")'));

// 3. Undo Patch
const undoResult = undoPatch(
  applyResult.updatedSource,
  applyResult.patch,
  3,
  '    stripe_id = customer.get("metadata")["stripe_id"]'
);
ok(undoResult.success, 'Patch undo should succeed');
strictEqual(undoResult.patch.status, 'reverted');
strictEqual(undoResult.updatedSource, originalSource, 'Undone source should equal original source');

// 4. Hash Mismatch / Conflict Detection
const modifiedSource = `// Unrelated top comment added\ndef process_charge(customer: dict):\n    stripe_id = customer.get("metadata")["stripe_id"]\n`;
const conflictResult = applyPatch(modifiedSource, patch, 99, 99);
strictEqual(conflictResult.success, false, 'Should reject patch on out-of-bounds line');
strictEqual(conflictResult.patch.status, 'conflict');

console.log('✅ Patch Manager Tests Passed!');
