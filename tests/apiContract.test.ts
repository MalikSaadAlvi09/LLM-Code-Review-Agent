import { strictEqual, ok } from 'node:assert';
import { checkApiContracts } from '../src/lib/apiContractChecker';

console.log('🧪 Starting API Contract Checker Tests...');

const sampleFrontend = {
  path: 'src/components/ReviewRunner.tsx',
  content: `
    export async function fetchUsers() {
      // Calling /api/user instead of registered backend route /api/users
      const res = await safeApiFetch('/api/user', { method: 'GET' });
      return res.data;
    }

    export async function createOrder() {
      // Frontend uses GET instead of registered backend route POST
      const res = await safeApiFetch('/api/orders', { method: 'GET' });
      return res.data;
    }
  `
};

const sampleBackend = {
  path: 'server.ts',
  content: `
    app.get('/api/users', (req, res) => {
      res.json({ users: [] });
    });

    app.post('/api/orders', (req, res) => {
      res.json({ success: true });
    });
  `
};

const findings = checkApiContracts([sampleFrontend, sampleBackend]);

strictEqual(findings.length, 2, 'Should detect 2 API contract mismatches');

const pathMismatch = findings.find(f => f.title.includes('Route Path Mismatch'));
ok(pathMismatch, 'Should detect path mismatch (/api/user vs /api/users)');
strictEqual(pathMismatch?.callerLocation?.file, 'src/components/ReviewRunner.tsx');
strictEqual(pathMismatch?.handlerLocation?.file, 'server.ts');

const methodMismatch = findings.find(f => f.title.includes('Method Mismatch'));
ok(methodMismatch, 'Should detect HTTP method mismatch (GET vs POST for /api/orders)');

console.log('✅ API Contract Checker Tests Passed!');
