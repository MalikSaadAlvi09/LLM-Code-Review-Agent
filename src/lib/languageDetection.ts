export interface LanguageInfo {
  id: string;
  name: string;
  isConfig: boolean;
  isTextUncertain?: boolean;
}

const EXTENSION_MAP: Record<string, LanguageInfo> = {
  '.py': { id: 'python', name: 'Python', isConfig: false },
  '.pyw': { id: 'python', name: 'Python', isConfig: false },
  '.js': { id: 'javascript', name: 'JavaScript', isConfig: false },
  '.jsx': { id: 'javascript', name: 'JavaScript (React)', isConfig: false },
  '.mjs': { id: 'javascript', name: 'JavaScript (ESM)', isConfig: false },
  '.cjs': { id: 'javascript', name: 'JavaScript (CJS)', isConfig: false },
  '.ts': { id: 'typescript', name: 'TypeScript', isConfig: false },
  '.tsx': { id: 'typescript', name: 'TypeScript (React)', isConfig: false },
  '.mts': { id: 'typescript', name: 'TypeScript (ESM)', isConfig: false },
  '.cts': { id: 'typescript', name: 'TypeScript (CJS)', isConfig: false },
  '.java': { id: 'java', name: 'Java', isConfig: false },
  '.c': { id: 'c', name: 'C', isConfig: false },
  '.h': { id: 'c', name: 'C/C++ Header', isConfig: false },
  '.cc': { id: 'cpp', name: 'C++', isConfig: false },
  '.cpp': { id: 'cpp', name: 'C++', isConfig: false },
  '.cxx': { id: 'cpp', name: 'C++', isConfig: false },
  '.hpp': { id: 'cpp', name: 'C++ Header', isConfig: false },
  '.hh': { id: 'cpp', name: 'C++ Header', isConfig: false },
  '.cs': { id: 'csharp', name: 'C#', isConfig: false },
  '.go': { id: 'go', name: 'Go', isConfig: false },
  '.rs': { id: 'rust', name: 'Rust', isConfig: false },
  '.php': { id: 'php', name: 'PHP', isConfig: false },
  '.rb': { id: 'ruby', name: 'Ruby', isConfig: false },
  '.swift': { id: 'swift', name: 'Swift', isConfig: false },
  '.kt': { id: 'kotlin', name: 'Kotlin', isConfig: false },
  '.kts': { id: 'kotlin', name: 'Kotlin Script', isConfig: false },
  '.dart': { id: 'dart', name: 'Dart', isConfig: false },
  '.scala': { id: 'scala', name: 'Scala', isConfig: false },
  '.sc': { id: 'scala', name: 'Scala', isConfig: false },
  '.r': { id: 'r', name: 'R', isConfig: false },
  '.R': { id: 'r', name: 'R', isConfig: false },
  '.jl': { id: 'julia', name: 'Julia', isConfig: false },
  '.lua': { id: 'lua', name: 'Lua', isConfig: false },
  '.pl': { id: 'perl', name: 'Perl', isConfig: false },
  '.pm': { id: 'perl', name: 'Perl Module', isConfig: false },
  '.sh': { id: 'shell', name: 'Bash / Shell', isConfig: false },
  '.bash': { id: 'shell', name: 'Bash', isConfig: false },
  '.zsh': { id: 'shell', name: 'Zsh', isConfig: false },
  '.ps1': { id: 'powershell', name: 'PowerShell', isConfig: false },
  '.psm1': { id: 'powershell', name: 'PowerShell Module', isConfig: false },
  '.sql': { id: 'sql', name: 'SQL', isConfig: false },
  '.sol': { id: 'solidity', name: 'Solidity', isConfig: false },
  '.m': { id: 'objective-c', name: 'Objective-C', isConfig: false },
  '.mm': { id: 'objective-cpp', name: 'Objective-C++', isConfig: false },
  '.asm': { id: 'assembly', name: 'Assembly', isConfig: false },
  '.s': { id: 'assembly', name: 'Assembly', isConfig: false },
  '.S': { id: 'assembly', name: 'Assembly', isConfig: false },
  '.html': { id: 'html', name: 'HTML', isConfig: true },
  '.htm': { id: 'html', name: 'HTML', isConfig: true },
  '.css': { id: 'css', name: 'CSS', isConfig: true },
  '.scss': { id: 'scss', name: 'SCSS', isConfig: true },
  '.less': { id: 'less', name: 'Less', isConfig: true },
  '.json': { id: 'json', name: 'JSON', isConfig: true },
  '.jsonc': { id: 'json', name: 'JSON with Comments', isConfig: true },
  '.yaml': { id: 'yaml', name: 'YAML', isConfig: true },
  '.yml': { id: 'yaml', name: 'YAML', isConfig: true },
  '.xml': { id: 'xml', name: 'XML', isConfig: true },
  '.toml': { id: 'toml', name: 'TOML', isConfig: true },
  '.tf': { id: 'terraform', name: 'Terraform', isConfig: true },
  '.tfvars': { id: 'terraform', name: 'Terraform Variables', isConfig: true },
  '.md': { id: 'markdown', name: 'Markdown', isConfig: true },
  '.graphql': { id: 'graphql', name: 'GraphQL', isConfig: false },
  '.gql': { id: 'graphql', name: 'GraphQL', isConfig: false },
  '.proto': { id: 'protobuf', name: 'Protocol Buffers', isConfig: false },
};

const FILENAME_MAP: Record<string, LanguageInfo> = {
  'dockerfile': { id: 'dockerfile', name: 'Dockerfile', isConfig: true },
  'makefile': { id: 'makefile', name: 'Makefile', isConfig: true },
  'jenkinsfile': { id: 'jenkinsfile', name: 'Jenkinsfile', isConfig: true },
  'vagrantfile': { id: 'ruby', name: 'Ruby (Vagrantfile)', isConfig: true },
  'cmakelists.txt': { id: 'cmake', name: 'CMake', isConfig: true },
  'gemfile': { id: 'ruby', name: 'Ruby (Gemfile)', isConfig: true },
  'rakefile': { id: 'ruby', name: 'Ruby (Rakefile)', isConfig: false },
  'package.json': { id: 'json', name: 'JSON (package.json)', isConfig: true },
  'cargo.toml': { id: 'toml', name: 'TOML (Cargo.toml)', isConfig: true },
  'go.mod': { id: 'go-mod', name: 'Go Module (go.mod)', isConfig: true },
  'pyproject.toml': { id: 'toml', name: 'TOML (pyproject.toml)', isConfig: true },
  'requirements.txt': { id: 'pip-requirements', name: 'Python Requirements', isConfig: true },
  'pom.xml': { id: 'xml', name: 'Maven POM (xml)', isConfig: true },
  'build.gradle': { id: 'groovy', name: 'Gradle (Groovy)', isConfig: true },
  'build.gradle.kts': { id: 'kotlin', name: 'Gradle (Kotlin)', isConfig: true },
  'pubspec.yaml': { id: 'yaml', name: 'Flutter Pubspec (yaml)', isConfig: true },
};

const SECRET_PATTERNS = [
  /(^|\/)\.env(\..*)?$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.pfx$/i,
  /\.p12$/i,
  /id_rsa/i,
  /id_ed25519/i,
  /credentials\.json$/i,
  /service[-_]?account.*\.json$/i,
  /secret/i,
];

const IGNORED_PATH_PATTERNS = [
  /(^|\/)(\.git|\.github|\.vscode|\.idea|\.cache|node_modules|vendor|dist|build|coverage|\.next|\.nuxt|venv|\.venv|env|__pycache__|\.pytest_cache|\.mypy_cache|target|bin|obj|Pods|DerivedData)(\/|$)/i,
  /\.min\.(js|css)$/i,
  /\.map$/i,
  /\.lock$/i,
  /package-lock\.json$/i,
  /yarn\.lock$/i,
  /pnpm-lock\.yaml$/i,
  /bun\.lock$/i,
  /\.(png|jpe?g|gif|svg|ico|pdf|eot|ttf|woff2?|zip|tar|gz|7z|rar|exe|dll|so|dylib|o|obj|pyc|class|jar)$/i,
];

export function detectLanguage(filePath: string, content?: string): LanguageInfo {
  const normalized = filePath.replaceAll('\\', '/');
  const basename = normalized.split('/').pop()?.toLowerCase() || '';

  // Check exact filename matches (e.g. Dockerfile, Makefile, package.json)
  if (FILENAME_MAP[basename]) {
    return FILENAME_MAP[basename];
  }
  if (basename.startsWith('dockerfile')) {
    return { id: 'dockerfile', name: 'Dockerfile', isConfig: true };
  }

  // Check extension matches
  const dotIndex = basename.lastIndexOf('.');
  if (dotIndex >= 0) {
    const ext = basename.slice(dotIndex);
    if (EXTENSION_MAP[ext]) {
      return EXTENSION_MAP[ext];
    }
  }

  // Check shebang line for extensionless scripts
  if (content) {
    const firstLine = content.trimStart().split('\n')[0] || '';
    if (firstLine.startsWith('#!')) {
      const lowerHeader = firstLine.toLowerCase();
      if (lowerHeader.includes('python')) return { id: 'python', name: 'Python', isConfig: false };
      if (lowerHeader.includes('node') || lowerHeader.includes('bun') || lowerHeader.includes('deno')) {
        return { id: 'javascript', name: 'JavaScript', isConfig: false };
      }
      if (lowerHeader.includes('bash') || lowerHeader.includes('sh') || lowerHeader.includes('zsh')) {
        return { id: 'shell', name: 'Bash / Shell', isConfig: false };
      }
      if (lowerHeader.includes('ruby')) return { id: 'ruby', name: 'Ruby', isConfig: false };
      if (lowerHeader.includes('perl')) return { id: 'perl', name: 'Perl', isConfig: false };
      if (lowerHeader.includes('php')) return { id: 'php', name: 'PHP', isConfig: false };
    }
  }

  // Fallback for unknown text files
  return {
    id: 'text',
    name: 'Text (Uncertain)',
    isConfig: true,
    isTextUncertain: true,
  };
}

export function isSecretFile(filePath: string): boolean {
  const normalized = filePath.replaceAll('\\', '/');
  const basename = normalized.split('/').pop() || '';
  return SECRET_PATTERNS.some(pattern => pattern.test(normalized) || pattern.test(basename));
}

export function isIgnoredPath(filePath: string): boolean {
  const normalized = filePath.replaceAll('\\', '/');
  return IGNORED_PATH_PATTERNS.some(pattern => pattern.test(normalized));
}

export function getLanguageName(langId: string): string {
  const found = Object.values(EXTENSION_MAP).find(l => l.id === langId) || Object.values(FILENAME_MAP).find(l => l.id === langId);
  return found?.name || langId.toUpperCase();
}
