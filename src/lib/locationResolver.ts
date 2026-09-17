import { Finding, EvidenceSource, SeverityLevel, LocationType } from '../types';

export interface FormattedLocation {
  filePath: string;
  startLine?: number;
  endLine?: number;
  column?: number;
  locationType?: LocationType;
  formattedString: string;
  githubUrl?: string;
}

/**
 * Sanitizes and normalizes file paths to be strictly repository-relative.
 * Strips temporary server directory prefixes (e.g. C:\Users\..., /tmp/..., /var/folders/...)
 */
export function normalizeRepositoryPath(rawPath: string): string {
  if (!rawPath) return '';

  let path = rawPath.replace(/\\/g, '/');

  // Strip common temp directory patterns and temp repo folder ids
  path = path.replace(/^(?:[a-zA-Z]:)?(?:\/[^/]+)*?\/(?:tmp|temp|uploads|repos|repositories)(?:\/[^/]+){1,2}\//i, '');
  path = path.replace(/^(?:[a-zA-Z]:)?(?:\/[^/]+)*?\/(?:antigravity-ide|llm-code-review-agent)\//i, '');
  
  // If path still has a leading folder that matches repo123 or temporary uuid pattern
  path = path.replace(/^(?:repo\d+|[0-9a-f-]{10,})\//i, '');

  // Strip leading slash or dot slash
  path = path.replace(/^\/+/, '').replace(/^\.\/+/, '');

  return path;
}

/**
 * Formats a finding location into a standardized readable string.
 * Example: "src/services/authService.ts:42–48" or "package.json"
 */
export function formatFindingLocation(
  file?: string,
  startLine?: number,
  endLine?: number,
  column?: number
): string {
  if (!file) return 'Repository-wide';
  const normalizedPath = normalizeRepositoryPath(file);
  if (!normalizedPath) return 'Repository-wide';

  if (startLine && startLine > 0) {
    if (endLine && endLine > startLine) {
      return `${normalizedPath}:${startLine}–${endLine}`;
    }
    if (column && column > 0) {
      return `${normalizedPath}:${startLine}:${column}`;
    }
    return `${normalizedPath}:${startLine}`;
  }

  return normalizedPath;
}

/**
 * Generates a GitHub permalink if owner, repo, commitSha are available.
 */
export function generateGitHubUrl(
  repoOwner?: string,
  repoName?: string,
  commitSha?: string,
  filePath?: string,
  startLine?: number,
  endLine?: number
): string | undefined {
  if (!repoOwner || !repoName || !commitSha || !filePath) return undefined;

  const normalizedPath = normalizeRepositoryPath(filePath);
  const ref = commitSha || 'main';

  let url = `https://github.com/${repoOwner}/${repoName}/blob/${ref}/${normalizedPath}`;

  if (startLine && startLine > 0) {
    if (endLine && endLine > startLine) {
      url += `#L${startLine}-L${endLine}`;
    } else {
      url += `#L${startLine}`;
    }
  }

  return url;
}

/**
 * Normalizes legacy severity string ('bug', 'logic', 'style') to SeverityLevel.
 */
export function normalizeSeverity(sev: string): SeverityLevel {
  if (sev === 'Critical' || sev === 'High' || sev === 'Medium' || sev === 'Low' || sev === 'Informational') {
    return sev;
  }
  if (sev === 'bug') return 'High';
  if (sev === 'logic') return 'Medium';
  if (sev === 'style') return 'Low';
  return 'Medium';
}

/**
 * Generates a full Markdown export report of the code review.
 */
export function generateMarkdownReport(
  reviewResult: {
    summary: string;
    filesReviewed?: number;
    filesDiscovered?: number;
    filesSkipped?: number;
    filesFailed?: number;
    findings: Finding[];
    coverageDetails?: { skippedFiles?: { path: string; reason: string }[]; failedFiles?: { path: string; reason: string }[] };
  },
  repoMetadata?: { owner?: string; repo?: string; commitSha?: string }
): string {
  const dateStr = new Date().toISOString().split('T')[0];
  const findings = reviewResult.findings || [];

  let md = `# AI Code Review Report\n\n`;
  md += `**Date**: ${dateStr}\n`;
  if (repoMetadata?.owner && repoMetadata?.repo) {
    md += `**Repository**: ${repoMetadata.owner}/${repoMetadata.repo}\n`;
    if (repoMetadata.commitSha) {
      md += `**Commit SHA**: \`${repoMetadata.commitSha}\`\n`;
    }
  }

  md += `\n## Executive Summary\n\n${reviewResult.summary || 'No summary provided.'}\n\n`;

  md += `## Review Coverage\n\n`;
  md += `- **Files Discovered**: ${reviewResult.filesDiscovered ?? 0}\n`;
  md += `- **Files Reviewed**: ${reviewResult.filesReviewed ?? findings.length}\n`;
  md += `- **Files Skipped**: ${reviewResult.filesSkipped ?? reviewResult.coverageDetails?.skippedFiles?.length ?? 0}\n`;
  md += `- **Files Failed**: ${reviewResult.filesFailed ?? reviewResult.coverageDetails?.failedFiles?.length ?? 0}\n\n`;

  // Findings Summary Table
  const critical = findings.filter(f => normalizeSeverity(f.severity) === 'Critical').length;
  const high = findings.filter(f => normalizeSeverity(f.severity) === 'High').length;
  const medium = findings.filter(f => normalizeSeverity(f.severity) === 'Medium').length;
  const low = findings.filter(f => normalizeSeverity(f.severity) === 'Low').length;
  const info = findings.filter(f => normalizeSeverity(f.severity) === 'Informational').length;

  md += `### Findings Breakdown\n\n`;
  md += `| Severity | Count |\n| --- | --- |\n`;
  md += `| 🚨 Critical | ${critical} |\n`;
  md += `| 🔴 High | ${high} |\n`;
  md += `| 🟠 Medium | ${medium} |\n`;
  md += `| 🟡 Low | ${low} |\n`;
  md += `| 🔵 Informational | ${info} |\n`;
  md += `| **Total** | **${findings.length}** |\n\n`;

  // Detailed Findings List
  md += `## Detailed Findings\n\n`;

  if (findings.length === 0) {
    md += `*No issues detected.* 🎉\n`;
  } else {
    findings.forEach((finding, index) => {
      const normalizedSev = normalizeSeverity(finding.severity);
      const locStr = formatFindingLocation(finding.file, finding.startLine || finding.line, finding.endLine, finding.column);
      const ghUrl = generateGitHubUrl(repoMetadata?.owner, repoMetadata?.repo, repoMetadata?.commitSha, finding.file, finding.startLine || finding.line, finding.endLine);
      const sourceBadge = finding.evidenceSource === 'Compiler' || finding.evidenceSource === 'Linter' || finding.status === 'confirmed'
        ? `✅ ${finding.evidenceSource || 'Confirmed Tool Finding'}`
        : `🤖 ${finding.evidenceSource || 'AI Suspected'}`;

      md += `### ${index + 1}. [${normalizedSev}] ${finding.title}\n\n`;
      md += `- **Location**: ${ghUrl ? `[${locStr}](${ghUrl})` : `\`${locStr}\``}\n`;
      md += `- **Category**: \`${finding.category || 'General'}\`\n`;
      md += `- **Evidence**: ${sourceBadge}\n`;
      if (finding.scope) md += `- **Scope**: \`${finding.scope}\`\n`;
      md += `\n**Description**:\n${finding.description}\n\n`;

      if (finding.triggerImpact) {
        md += `**Trigger & Impact**:\n${finding.triggerImpact}\n\n`;
      }

      if (finding.codeSnippet) {
        md += `**Code Snippet**:\n\`\`\`\n${finding.codeSnippet}\n\`\`\`\n\n`;
      }

      if (finding.suggested_fix) {
        md += `**Suggested Fix**:\n\`\`\`\n${finding.suggested_fix}\n\`\`\`\n\n`;
      }

      if (finding.fixExplanation) {
        md += `**Fix Rationale**:\n${finding.fixExplanation}\n\n`;
      }

      if (finding.uncertaintyNote) {
        md += `> ⚠️ **Note**: ${finding.uncertaintyNote}\n\n`;
      }

      md += `---\n\n`;
    });
  }

  return md;
}

/**
 * Generates a full structured JSON export object of the review result.
 */
export function generateJsonReport(
  reviewResult: any,
  repoMetadata?: { owner?: string; repo?: string; commitSha?: string }
) {
  return {
    exportVersion: '2.0.0',
    generatedAt: new Date().toISOString(),
    repository: repoMetadata || null,
    review: {
      summary: reviewResult.summary,
      metrics: {
        filesDiscovered: reviewResult.filesDiscovered ?? 0,
        filesReviewed: reviewResult.filesReviewed ?? 0,
        filesSkipped: reviewResult.filesSkipped ?? 0,
        filesFailed: reviewResult.filesFailed ?? 0,
        totalFindings: reviewResult.findings?.length ?? 0,
      },
      coverageDetails: reviewResult.coverageDetails || [],
      findings: (reviewResult.findings || []).map((f: Finding) => ({
        ...f,
        normalizedSeverity: normalizeSeverity(f.severity),
        normalizedLocation: formatFindingLocation(f.file, f.startLine || f.line, f.endLine, f.column),
        githubUrl: generateGitHubUrl(repoMetadata?.owner, repoMetadata?.repo, repoMetadata?.commitSha, f.file, f.startLine || f.line, f.endLine),
      })),
    },
  };
}
