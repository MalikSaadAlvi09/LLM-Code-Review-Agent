import { detectLanguage, isSecretFile, isIgnoredPath } from '../src/lib/languageDetection';
import { detectTestFramework } from '../src/lib/testFrameworkDetector';
import { computeLineDiff } from '../src/lib/codeDiff';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✓ PASSED: ${message}`);
  }
}

async function runMultilingualTests() {
  console.log('Running Multilingual Code Review Unit & Integration Tests...\n');

  // 1. Language Detection Tests
  assert(detectLanguage('payment.py').id === 'python', 'Detect Python file');
  assert(detectLanguage('userService.ts').id === 'typescript', 'Detect TypeScript file');
  assert(detectLanguage('App.tsx').id === 'typescript', 'Detect React TSX file');
  assert(detectLanguage('reconciler.go').id === 'go', 'Detect Go file');
  assert(detectLanguage('OrderManager.java').id === 'java', 'Detect Java file');
  assert(detectLanguage('Dockerfile').id === 'dockerfile', 'Detect Dockerfile');
  assert(detectLanguage('dockerfile.dev').id === 'dockerfile', 'Detect Dockerfile variant');
  assert(detectLanguage('schema.sql').id === 'sql', 'Detect SQL file');
  assert(detectLanguage('main.rs').id === 'rust', 'Detect Rust file');
  assert(detectLanguage('contract.sol').id === 'solidity', 'Detect Solidity file');

  // Shebang test for extensionless file
  const shebangBash = detectLanguage('backup_script', '#!/bin/bash\necho hello');
  assert(shebangBash.id === 'shell', 'Detect extensionless bash script via shebang');

  // Unknown text file fallback
  const unknownFile = detectLanguage('unknown_data');
  assert(unknownFile.id === 'text' && unknownFile.isTextUncertain === true, 'Handle unknown text file gracefully with uncertainty label');

  // 2. Secret and Ignored Path Filtering Tests
  assert(isSecretFile('.env') === true, 'Identify .env as secret file');
  assert(isSecretFile('.env.production') === true, 'Identify .env.production as secret file');
  assert(isSecretFile('credentials.json') === true, 'Identify credentials.json as secret file');
  assert(isSecretFile('id_rsa') === true, 'Identify id_rsa as secret file');
  assert(isSecretFile('payment.py') === false, 'Do not misidentify source code as secret file');

  assert(isIgnoredPath('node_modules/express/index.js') === true, 'Ignore node_modules path');
  assert(isIgnoredPath('.git/HEAD') === true, 'Ignore .git path');
  assert(isIgnoredPath('dist/bundle.min.js') === true, 'Ignore minified bundle');
  assert(isIgnoredPath('src/index.ts') === false, 'Do not ignore src source files');

  // 3. Language-Aware Test Framework Selection Tests
  const pyFramework = detectTestFramework('python');
  assert(pyFramework.framework.includes('pytest'), 'Python test framework defaults to pytest');

  const tsFramework = detectTestFramework('typescript', [{ path: 'package.json', content: '"vitest": "^1.0.0"' }]);
  assert(tsFramework.framework === 'Vitest', 'TypeScript detects Vitest from package.json context');

  const javaFramework = detectTestFramework('java');
  assert(javaFramework.framework.includes('JUnit'), 'Java detects JUnit framework');

  const goFramework = detectTestFramework('go');
  assert(goFramework.framework.includes('Go testing'), 'Go detects native testing package');

  const rustFramework = detectTestFramework('rust');
  assert(rustFramework.framework.includes('cargo test'), 'Rust detects cargo test framework');

  const csFramework = detectTestFramework('csharp');
  assert(csFramework.framework.includes('xUnit'), 'C# detects xUnit framework');

  // 4. Line Diff Generator Tests
  const orig = 'function add(a, b) {\n  return a + b;\n}';
  const refactored = 'function add(a: number, b: number): number {\n  return a + b;\n}';
  const diffs = computeLineDiff(orig, refactored);
  assert(diffs.some(d => d.type === 'delete' && d.content.includes('function add(a, b)')), 'Diff captures deleted original line');
  assert(diffs.some(d => d.type === 'add' && d.content.includes('a: number')), 'Diff captures added refactored line');

  console.log('\nAll Multilingual Unit & Integration Tests Passed Successfully!');
}

runMultilingualTests().catch(err => {
  console.error('Multilingual tests crashed:', err);
  process.exit(1);
});
