import { CustomRule, Finding, SeverityLevel } from '../types';

export const DEFAULT_CUSTOM_RULES: CustomRule[] = [
  {
    id: 'rule_no_eval',
    name: 'Prohibit Unsafe Eval',
    category: 'Security',
    pattern: '\\beval\\s*\\(',
    severity: 'Critical',
    description: 'Use of `eval()` allows dynamic code execution and poses severe security risks.',
    enabled: true
  },
  {
    id: 'rule_no_console_log',
    name: 'Flag Leftover Console Logs',
    category: 'Clean Code',
    pattern: 'console\\.log\\s*\\(',
    severity: 'Low',
    description: 'Avoid committing debugging `console.log()` statements to production.',
    enabled: true
  },
  {
    id: 'rule_no_bare_except',
    name: 'Prohibit Bare Except in Python',
    category: 'Error Handling',
    pattern: 'except\\s*:',
    severity: 'Medium',
    description: 'Bare `except:` catches `KeyboardInterrupt` and `SystemExit`. Use `except Exception:` instead.',
    enabled: true
  }
];

/**
 * Evaluates custom rules against source files and generates findings for rule matches.
 */
export function evaluateCustomRules(
  files: { path: string; content: string }[],
  rules: CustomRule[] = DEFAULT_CUSTOM_RULES
): Finding[] {
  const findings: Finding[] = [];
  const activeRules = rules.filter(r => r.enabled);

  files.forEach(f => {
    const lines = f.content.split('\n');
    activeRules.forEach(rule => {
      let regex: RegExp;
      try {
        regex = new RegExp(rule.pattern, 'g');
      } catch {
        return;
      }

      lines.forEach((lineText, idx) => {
        if (regex.test(lineText)) {
          findings.push({
            line: idx + 1,
            startLine: idx + 1,
            file: f.path,
            title: `[Custom Rule] ${rule.name}`,
            severity: rule.severity,
            category: rule.category,
            evidenceSource: 'Linter',
            status: 'confirmed',
            findingState: 'tool_reported',
            description: rule.description,
            codeSnippet: lineText.trim(),
            suggested_fix: `Remove or update '${lineText.trim()}' to comply with project custom rule.`,
            fixExplanation: `Violates custom project review rule: ${rule.name}`
          });
        }
      });
    });
  });

  return findings;
}
