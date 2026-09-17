export interface SecretMatch {
  category: string;
  matchedText: string;
  maskedText: string;
  line: number;
  column: number;
  remediationAdvice: string;
}

const SECRET_PATTERNS: { category: string; regex: RegExp; advice: string }[] = [
  {
    category: 'AWS Access Key',
    regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    advice: 'Revoke key in AWS IAM dashboard immediately. Use AWS Secrets Manager or environment variables.'
  },
  {
    category: 'AWS Secret Access Key',
    regex: /(?:aws_secret_access_key|aws_secret_key)\s*[:=]\s*["']?([A-Za-z0-9/+=]{40})["']?/gi,
    advice: 'Revoke secret key in AWS IAM dashboard immediately. Rotate credentials and migrate to IAM roles.'
  },
  {
    category: 'GitHub Token',
    regex: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{30,255}/g,
    advice: 'Revoke token in GitHub Developer Settings. Store in repository secrets or server environment variables.'
  },
  {
    category: 'Google / Gemini API Key',
    regex: /AIzaSy[A-Za-z0-9_-]{30,35}/g,
    advice: 'Revoke API key in Google Cloud Console. Set GEMINI_API_KEY environment variable on backend server.'
  },
  {
    category: 'OpenAI API Key',
    regex: /sk-[A-Za-z0-9]{32,64}/g,
    advice: 'Revoke API key in OpenAI dashboard immediately. Never expose API keys in frontend code.'
  },
  {
    category: 'Stripe Secret Key',
    regex: /sk_(?:live|test)_[0-9a-zA-Z]{24,99}/g,
    advice: 'Revoke secret key in Stripe Dashboard. Keep secret keys strictly in backend environment variables.'
  },
  {
    category: 'Private RSA / SSH Key',
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    advice: 'Revoke SSH key access. Generate a new keypair and remove private key from git history.'
  },
  {
    category: 'Database Connection URI',
    regex: /(?:postgres|postgresql|mysql|mongodb|redis):\/\/[a-zA-Z0-9_]+:[^@\s]+@[a-zA-Z0-9_.-]+:\d+\/[a-zA-Z0-9_.-]+/gi,
    advice: 'Change database user password. Store connection string in secure secret manager.'
  }
];

/**
 * Scans string content for secrets and returns detailed match results.
 */
export function scanSecrets(content: string): SecretMatch[] {
  if (!content) return [];
  const matches: SecretMatch[] = [];
  const lines = content.split('\n');

  lines.forEach((lineText, lineIdx) => {
    SECRET_PATTERNS.forEach(pat => {
      // Re-create regex instance to reset lastIndex
      const regex = new RegExp(pat.regex.source, pat.regex.flags);
      let match: RegExpExecArray | null;
      while ((match = regex.exec(lineText)) !== null) {
        const fullMatch = match[0];
        const masked = `[REDACTED_SECRET:${pat.category.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}]`;

        matches.push({
          category: pat.category,
          matchedText: fullMatch,
          maskedText: masked,
          line: lineIdx + 1,
          column: match.index + 1,
          remediationAdvice: pat.advice
        });
      }
    });
  });

  return matches;
}

/**
 * Masks all detected secrets in text for safe UI rendering, logging, and AI prompt dispatch.
 */
export function maskSecretsInText(text: string): string {
  if (!text) return '';
  let sanitized = text;

  SECRET_PATTERNS.forEach(pat => {
    const regex = new RegExp(pat.regex.source, pat.regex.flags);
    const maskLabel = `[REDACTED_SECRET:${pat.category.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}]`;
    sanitized = sanitized.replace(regex, maskLabel);
  });

  return sanitized;
}
