import { strictEqual, ok } from 'node:assert';
import { scanSecrets, maskSecretsInText } from '../src/lib/secretScanner';

console.log('🧪 Starting Secret Scanner & Masking Tests...');

// 1. AWS Key Detection
const awsSnippet = 'const key = "AKIAIOSFODNN7EXAMPLE";';
const awsMatches = scanSecrets(awsSnippet);
strictEqual(awsMatches.length, 1, 'Should detect AWS Access Key');
strictEqual(awsMatches[0].category, 'AWS Access Key');

// 2. Gemini API Key Detection
const geminiSnippet = 'const geminiKey = "AIzaSyD-1234567890abcdefghijklmnopqrst";';
const geminiMatches = scanSecrets(geminiSnippet);
strictEqual(geminiMatches.length, 1, 'Should detect Gemini API key');
strictEqual(geminiMatches[0].category, 'Google / Gemini API Key');

// 3. GitHub Token Detection
const ghSnippet = 'const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";';
const ghMatches = scanSecrets(ghSnippet);
strictEqual(ghMatches.length, 1, 'Should detect GitHub token');

// 4. Masking Verification
const rawLog = 'Connecting to DB with postgres://admin:SecretPass123@db.example.com:5432/main using key AIzaSyD-1234567890abcdefghijklmnopqrst';
const maskedLog = maskSecretsInText(rawLog);

ok(!maskedLog.includes('SecretPass123'), 'Raw password should be masked');
ok(!maskedLog.includes('AIzaSyD-1234567890abcdefghijklmnopqrst'), 'Raw API key should be masked');
ok(maskedLog.includes('[REDACTED_SECRET:GOOGLE_GEMINI_API_KEY]'), 'Mask label should be present');

console.log('✅ Secret Scanner & Masking Tests Passed!');
