import { equal, strictEqual, ok } from 'node:assert';
import {
  normalizeRepositoryPath,
  formatFindingLocation,
  generateGitHubUrl,
  normalizeSeverity,
  generateMarkdownReport,
  generateJsonReport,
} from '../src/lib/locationResolver';
import { Finding } from '../src/types';

console.log('🧪 Starting Detailed Location Resolution & Export Tests...');

// 1. Test Path Normalization
strictEqual(
  normalizeRepositoryPath('C:\\Users\\Temp\\uploads\\repo123\\src\\index.ts'),
  'src/index.ts',
  'Should strip Windows temp prefix'
);
strictEqual(
  normalizeRepositoryPath('/tmp/repos/my-repo/functions/src/api.ts'),
  'functions/src/api.ts',
  'Should strip POSIX temp prefix'
);
strictEqual(
  normalizeRepositoryPath('./src/components/ReviewRunner.tsx'),
  'src/components/ReviewRunner.tsx',
  'Should strip leading dot-slash'
);

// 2. Test Location Formatting
strictEqual(
  formatFindingLocation('src/services/authService.ts', 42, 48),
  'src/services/authService.ts:42–48',
  'Should format range location'
);
strictEqual(
  formatFindingLocation('src/services/authService.ts', 42),
  'src/services/authService.ts:42',
  'Should format single line location'
);
strictEqual(
  formatFindingLocation('package.json'),
  'package.json',
  'Should format file-wide location'
);

// 3. Test GitHub URL Generation
strictEqual(
  generateGitHubUrl('acme', 'backend', 'a1b2c3d', 'src/auth.ts', 15, 25),
  'https://github.com/acme/backend/blob/a1b2c3d/src/auth.ts#L15-L25',
  'Should build GitHub range URL'
);
strictEqual(
  generateGitHubUrl('acme', 'backend', 'a1b2c3d', 'src/auth.ts', 15),
  'https://github.com/acme/backend/blob/a1b2c3d/src/auth.ts#L15',
  'Should build GitHub single line URL'
);

// 4. Test Severity Normalization
strictEqual(normalizeSeverity('bug'), 'High');
strictEqual(normalizeSeverity('logic'), 'Medium');
strictEqual(normalizeSeverity('style'), 'Low');
strictEqual(normalizeSeverity('Critical'), 'Critical');

// 5. Test Markdown Report Generation
const sampleReview = {
  summary: 'Code review completed with 2 findings.',
  filesDiscovered: 5,
  filesReviewed: 4,
  filesSkipped: 1,
  filesFailed: 0,
  findings: [
    {
      line: 10,
      title: 'SQL Injection Vulnerability',
      description: 'User input concatenated directly into SQL query string.',
      severity: 'Critical' as const,
      category: 'Security',
      file: 'src/db/users.ts',
      startLine: 10,
      endLine: 14,
      codeSnippet: 'db.query("SELECT * FROM users WHERE id = " + req.params.id);',
      suggested_fix: 'db.query("SELECT * FROM users WHERE id = $1", [req.params.id]);',
      evidenceSource: 'Compiler' as const,
      status: 'confirmed' as const,
      locationType: 'line' as const,
    },
    {
      line: 5,
      title: 'Missing Return Type Annotation',
      description: 'Function export lacks explicit return type.',
      severity: 'Low' as const,
      category: 'Style',
      file: 'src/utils/format.ts',
      startLine: 5,
      suggested_fix: 'export function format(val: unknown): string',
      evidenceSource: 'AI Review' as const,
      status: 'suspected' as const,
      locationType: 'line' as const,
    }
  ],
};

const mdReport = generateMarkdownReport(sampleReview, { owner: 'acme', repo: 'backend', commitSha: 'a1b2c3d' });
ok(mdReport.includes('# AI Code Review Report'), 'MD Report should have header');
ok(mdReport.includes('SQL Injection Vulnerability'), 'MD Report should include finding title');
ok(mdReport.includes('[src/db/users.ts:10–14](https://github.com/acme/backend/blob/a1b2c3d/src/db/users.ts#L10-L14)'), 'MD Report should contain formatted GitHub deep link');

// 6. Test JSON Export Generation
const jsonReport = generateJsonReport(sampleReview, { owner: 'acme', repo: 'backend', commitSha: 'a1b2c3d' });
strictEqual(jsonReport.exportVersion, '2.0.0', 'JSON export version should be 2.0.0');
strictEqual(jsonReport.review.findings.length, 2, 'JSON export should contain 2 findings');
strictEqual(jsonReport.review.findings[0].normalizedLocation, 'src/db/users.ts:10–14', 'JSON finding should have normalizedLocation');

console.log('✅ All Detailed Location Resolution & Export Tests Passed!');
