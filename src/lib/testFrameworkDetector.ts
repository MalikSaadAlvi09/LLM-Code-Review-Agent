export interface TestFrameworkInfo {
  framework: string;
  command: string;
  filePattern: string;
  setupRequired?: string;
}

export function detectTestFramework(
  languageId: string,
  projectFiles: { path: string; content?: string }[] = []
): TestFrameworkInfo {
  const lang = (languageId || '').toLowerCase();

  // Python
  if (lang === 'python') {
    const hasPytest = projectFiles.some(f => f.path.includes('pytest') || (f.content && f.content.includes('import pytest')));
    return {
      framework: hasPytest ? 'pytest' : 'pytest / unittest',
      command: 'pytest tests/',
      filePattern: 'test_*.py',
      setupRequired: hasPytest ? undefined : 'Install pytest: pip install pytest',
    };
  }

  // TypeScript / JavaScript
  if (lang === 'typescript' || lang === 'javascript') {
    const hasVitest = projectFiles.some(f => f.path.includes('vitest') || (f.content && f.content.includes('vitest')));
    const hasJest = projectFiles.some(f => f.path.includes('jest') || (f.content && f.content.includes('jest')));

    const fw = hasVitest ? 'Vitest' : hasJest ? 'Jest' : 'Jest / Vitest';
    return {
      framework: fw,
      command: hasVitest ? 'npx vitest run' : 'npm test',
      filePattern: '*.test.ts / *.spec.ts',
      setupRequired: hasVitest || hasJest ? undefined : 'Install Vitest: npm install -D vitest',
    };
  }

  // Java
  if (lang === 'java') {
    return {
      framework: 'JUnit 5',
      command: 'mvn test / gradlew test',
      filePattern: '*Test.java',
      setupRequired: 'Add org.junit.jupiter:junit-jupiter dependency',
    };
  }

  // Go
  if (lang === 'go') {
    return {
      framework: 'Go testing package',
      command: 'go test ./...',
      filePattern: '*_test.go',
    };
  }

  // Rust
  if (lang === 'rust') {
    return {
      framework: 'cargo test (built-in)',
      command: 'cargo test',
      filePattern: 'tests/*.rs or #[cfg(test)]',
    };
  }

  // C#
  if (lang === 'csharp') {
    return {
      framework: 'xUnit / NUnit',
      command: 'dotnet test',
      filePattern: '*Tests.cs',
      setupRequired: 'dotnet add package xunit',
    };
  }

  // PHP
  if (lang === 'php') {
    return {
      framework: 'PHPUnit',
      command: './vendor/bin/phpunit',
      filePattern: '*Test.php',
      setupRequired: 'composer require --dev phpunit/phpunit',
    };
  }

  // Ruby
  if (lang === 'ruby') {
    return {
      framework: 'RSpec / Minitest',
      command: 'bundle exec rspec',
      filePattern: '*_spec.rb',
      setupRequired: 'gem install rspec',
    };
  }

  // Swift
  if (lang === 'swift') {
    return {
      framework: 'XCTest / Swift Testing',
      command: 'swift test',
      filePattern: '*Tests.swift',
    };
  }

  // Kotlin
  if (lang === 'kotlin') {
    return {
      framework: 'kotlin.test / JUnit 5',
      command: './gradlew test',
      filePattern: '*Test.kt',
    };
  }

  // Dart
  if (lang === 'dart') {
    return {
      framework: 'dart test / flutter_test',
      command: 'dart test',
      filePattern: '*_test.dart',
    };
  }

  // C / C++
  if (lang === 'c' || lang === 'cpp') {
    return {
      framework: 'GoogleTest / Catch2',
      command: 'ctest --output-on-failure',
      filePattern: '*_test.cpp',
      setupRequired: 'Include GoogleTest or Catch2 header library',
    };
  }

  // Fallback for general languages
  return {
    framework: `${lang.toUpperCase()} Testing Framework`,
    command: 'run-tests',
    filePattern: 'test files',
    setupRequired: `Configure a test runner suitable for ${lang}`,
  };
}
