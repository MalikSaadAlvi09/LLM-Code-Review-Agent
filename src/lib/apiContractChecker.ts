import { Finding, EvidenceSource, SeverityLevel } from '../types';

export interface FrontendApiCall {
  file: string;
  line: number;
  method: string;
  url: string;
  expectsJson: boolean;
  codeSnippet: string;
}

export interface BackendRoute {
  file: string;
  line: number;
  method: string;
  path: string;
  codeSnippet: string;
}

/**
 * Extracts frontend API call invocations from source files.
 */
export function extractFrontendApiCalls(file: string, content: string): FrontendApiCall[] {
  const calls: FrontendApiCall[] = [];
  const lines = content.split('\n');

  // Regex patterns matching fetch, axios, safeApiFetch, etc.
  const fetchRegex = /(?:safeApiFetch|fetch|axios\.(get|post|put|delete|patch)|httpsCallable)\s*\(\s*['"`]([^'"`]+)['"`]/g;

  lines.forEach((lineText, idx) => {
    let match: RegExpExecArray | null;
    while ((match = fetchRegex.exec(lineText)) !== null) {
      let method = 'GET';
      const verbMatch = lineText.match(/method:\s*['"`](GET|POST|PUT|DELETE|PATCH)['"`]/i);
      if (verbMatch) {
        method = verbMatch[1].toUpperCase();
      } else if (match[1]) {
        method = match[1].toUpperCase();
      }

      const url = match[2];
      const expectsJson = lineText.includes('.json()') || lineText.includes('JSON.parse') || lineText.includes('safeApiFetch');

      calls.push({
        file,
        line: idx + 1,
        method,
        url,
        expectsJson,
        codeSnippet: lineText.trim()
      });
    }
  });

  return calls;
}

/**
 * Extracts backend route handlers from source files.
 */
export function extractBackendRoutes(file: string, content: string): BackendRoute[] {
  const routes: BackendRoute[] = [];
  const lines = content.split('\n');

  // Regex matching Express: app.get('/api/...'), router.post('/api/...'), FastAPI/Flask: @app.get('/api/...')
  const routeRegex = /(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

  lines.forEach((lineText, idx) => {
    let match: RegExpExecArray | null;
    while ((match = routeRegex.exec(lineText)) !== null) {
      routes.push({
        file,
        line: idx + 1,
        method: match[1].toUpperCase(),
        path: match[2],
        codeSnippet: lineText.trim()
      });
    }
  });

  return routes;
}

/**
 * Cross-analyzes frontend API calls against backend routes to locate contract mismatches.
 */
export function checkApiContracts(
  files: { path: string; content: string }[]
): Finding[] {
  const findings: Finding[] = [];
  const frontendCalls: FrontendApiCall[] = [];
  const backendRoutes: BackendRoute[] = [];

  files.forEach(f => {
    const fc = extractFrontendApiCalls(f.path, f.content);
    const br = extractBackendRoutes(f.path, f.content);
    frontendCalls.push(...fc);
    backendRoutes.push(...br);
  });

  frontendCalls.forEach(call => {
    // Only analyze internal /api/* endpoints
    if (!call.url.startsWith('/api/') && !call.url.startsWith('http://localhost') && !call.url.startsWith('https://')) {
      return;
    }

    const cleanCallPath = call.url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];

    // Look for exact route match
    const exactMatch = backendRoutes.find(r => r.path === cleanCallPath);

    if (exactMatch) {
      // Check method mismatch
      if (exactMatch.method !== call.method) {
        findings.push({
          line: call.line,
          startLine: call.line,
          file: call.file,
          title: `API Method Mismatch on ${cleanCallPath}`,
          severity: 'High',
          category: 'API Contract',
          evidenceSource: 'Compiler',
          status: 'confirmed',
          findingState: 'tool_reported',
          description: `Frontend invokes \`${call.method} ${cleanCallPath}\` at \`${call.file}:${call.line}\`, but backend route handler at \`${exactMatch.file}:${exactMatch.line}\` expects \`${exactMatch.method}\`.`,
          triggerImpact: `Requests will fail with HTTP 405 Method Not Allowed at runtime.`,
          codeSnippet: call.codeSnippet,
          suggested_fix: `Update fetch call method to '${exactMatch.method}' or update handler in '${exactMatch.file}'.`,
          fixExplanation: `Aligning HTTP verb between frontend caller and backend handler restores API contract.`,
          callerLocation: { file: call.file, line: call.line },
          handlerLocation: { file: exactMatch.file, line: exactMatch.line }
        });
      }
    } else {
      // Check near-miss route path (e.g. singular vs plural, missing trailing slash)
      const nearMiss = backendRoutes.find(r => {
        const p1 = r.path.replace(/\/+$/, '');
        const p2 = cleanCallPath.replace(/\/+$/, '');
        return p1.slice(0, 5) === p2.slice(0, 5) && (p1.includes(p2) || p2.includes(p1) || p1 + 's' === p2 || p2 + 's' === p1);
      });

      if (nearMiss) {
        findings.push({
          line: call.line,
          startLine: call.line,
          file: call.file,
          title: `API Route Path Mismatch: '${cleanCallPath}' vs '${nearMiss.path}'`,
          severity: 'Critical',
          category: 'API Contract',
          evidenceSource: 'Compiler',
          status: 'confirmed',
          findingState: 'tool_reported',
          description: `Frontend calls \`${call.url}\` at \`${call.file}:${call.line}\`, but backend route is registered as \`${nearMiss.path}\` at \`${nearMiss.file}:${nearMiss.line}\`.`,
          triggerImpact: `Requests will fail with HTTP 404 Not Found at runtime and may cause JSON parse errors on HTML 404 pages.`,
          codeSnippet: call.codeSnippet,
          suggested_fix: `Change request endpoint to '${nearMiss.path}'`,
          fixExplanation: `Matching the exact registered express backend route prevents HTTP 404 routing failures.`,
          callerLocation: { file: call.file, line: call.line },
          handlerLocation: { file: nearMiss.file, line: nearMiss.line }
        });
      }
    }
  });

  return findings;
}
