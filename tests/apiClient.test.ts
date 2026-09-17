import { safeApiFetch } from '../src/lib/apiClient';

// Minimal test runner assertion
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ PASSED: ${message}`);
  }
}

async function runTests() {
  console.log('Running safeApiFetch regression tests...');

  // Mock global fetch
  const originalFetch = globalThis.fetch;

  try {
    // Test 1: Successful JSON response
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ success: true, rawText: 'Refactored code' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const res1 = await safeApiFetch('/api/gemini/analyze', { method: 'POST' });
    assert(res1.ok === true, 'Test 1: ok should be true');
    assert(res1.status === 200, 'Test 1: status should be 200');
    assert(res1.data?.rawText === 'Refactored code', 'Test 1: data should contain rawText');

    // Test 2: Non-JSON HTML response (e.g. Vercel 404 HTML or Vite index.html)
    globalThis.fetch = (async () => {
      return new Response('The page could not be found', {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
      });
    }) as any;

    const res2 = await safeApiFetch('/api/gemini/analyze', { method: 'POST' });
    assert(res2.ok === false, 'Test 2: ok should be false for HTML 404');
    assert(res2.status === 404, 'Test 2: status should be 404');
    assert(res2.error?.includes('non-JSON response'), 'Test 2: error should describe non-JSON response');

    // Test 3: HTTP 400 Bad Request JSON
    globalThis.fetch = (async () => {
      return new Response(JSON.stringify({ error: 'OpenRouter API key is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const res3 = await safeApiFetch('/api/openrouter/analyze', { method: 'POST' });
    assert(res3.ok === false, 'Test 3: ok should be false for 400');
    assert(res3.status === 400, 'Test 3: status should be 400');
    assert(res3.error === 'OpenRouter API key is required.', 'Test 3: error message should match JSON error field');

    // Test 4: Invalid JSON with Content-Type application/json
    globalThis.fetch = (async () => {
      return new Response('Truncated { json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as any;

    const res4 = await safeApiFetch('/api/gemini/analyze', { method: 'POST' });
    assert(res4.ok === false, 'Test 4: ok should be false for malformed JSON');
    assert(res4.error?.includes('Invalid JSON response'), 'Test 4: error should indicate invalid JSON');

    // Test 5: Network failure
    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as any;

    const res5 = await safeApiFetch('/api/gemini/analyze', { method: 'POST' });
    assert(res5.ok === false, 'Test 5: ok should be false for network failure');
    assert(res5.status === 0, 'Test 5: status should be 0');
    assert(res5.error === 'Failed to fetch', 'Test 5: error should report network error message');

    console.log('\nAll safeApiFetch regression tests passed successfully!');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

runTests().catch(err => {
  console.error('Test script crashed:', err);
  process.exit(1);
});
