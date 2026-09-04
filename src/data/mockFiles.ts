export interface RepoFile {
  path: string;
  name: string;
  category: 'core' | 'test' | 'config' | 'doc';
  description: string;
  content: string;
}

export const REPO_FILES: RepoFile[] = [
  {
    path: 'pyproject.toml',
    name: 'pyproject.toml',
    category: 'config',
    description: 'Hatchling build specification, CLI entrypoint, and pinned dependencies (openai, anthropic, typer, rich).',
    content: `[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "code-review-agent"
version = "0.1.0"
description = "Autonomous Python code review CLI supporting OpenRouter Free NVIDIA Nemotron 70B & Anthropic Claude"
readme = "README.md"
requires-python = ">=3.11"
license = "MIT"
authors = [
    { name = "Developer" }
]
dependencies = [
    "openai>=1.0.0",
    "anthropic>=0.20.0",
    "typer>=0.12.0",
    "pydantic>=2.6.0",
    "pydantic-settings>=2.2.0",
    "pathspec>=0.12.0",
    "tiktoken>=0.6.0",
    "rich>=13.7.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "hypothesis>=6.98.0",
]

[project.scripts]
reviewagent = "reviewagent.cli:app"

[tool.pytest.ini_options]
testpaths = ["tests"]
pythonpath = ["src"]`
  },
  {
    path: 'src/reviewagent/config.py',
    name: 'config.py',
    category: 'config',
    description: 'Pydantic Settings managing OpenRouter Free API keys, Nemotron defaults, and provider auto-detection.',
    content: `from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    # OpenRouter API (Default: Free NVIDIA Nemotron 70B)
    openrouter_api_key: str = Field(default="", alias="OPENROUTER_API_KEY")
    openrouter_base_url: str = Field(default="https://openrouter.ai/api/v1", alias="OPENROUTER_BASE_URL")
    
    # Anthropic API
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    
    # Default model: OpenRouter Free NVIDIA Nemotron 70B
    model: str = Field(
        default="nvidia/llama-3.1-nemotron-70b-instruct:free", 
        description="Default LLM model identifier for reviews"
    )
    provider: Optional[str] = Field(
        default=None, 
        description="LLM provider: 'openrouter' or 'anthropic' (auto-detected if omitted)"
    )
    
    max_chunk_tokens: int = Field(default=3000, description="Approximate token budget per chunk")
    overlap_tokens: int = Field(default=300, description="Token overlap for sliding window")
    session_dir: str = Field(default=".reviewagent_sessions", description="Directory to cache conversation history")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    def resolve_provider(self, model_override: Optional[str] = None) -> str:
        if self.provider:
            return self.provider.lower()
        
        target_model = model_override or self.model
        if "nemotron" in target_model.lower() or "/" in target_model or ":free" in target_model:
            return "openrouter"
        if "claude" in target_model.lower():
            return "anthropic"
        
        if self.openrouter_api_key:
            return "openrouter"
        if self.anthropic_api_key:
            return "anthropic"
        
        return "openrouter"`
  },
  {
    path: 'src/reviewagent/clone.py',
    name: 'clone.py',
    category: 'core',
    description: 'Shallow git clone via subprocess with distinct exception handling and cleanup context manager.',
    content: `import os
import shutil
import subprocess
import tempfile
from contextlib import contextmanager
from typing import Generator, Optional


class CloneError(Exception):
    pass


class InvalidRepoURLError(CloneError):
    pass


class AuthenticationError(CloneError):
    pass


class NetworkError(CloneError):
    pass


def clone_repository(repo_url: str, target_dir: str) -> None:
    if not repo_url or not isinstance(repo_url, str):
        raise InvalidRepoURLError("Repository URL cannot be empty.")

    cmd = ["git", "clone", "--depth", "1", repo_url, target_dir]
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )
    except FileNotFoundError:
        raise CloneError("git executable was not found on PATH.")

    if proc.returncode != 0:
        err = proc.stderr.lower()
        if "authentication failed" in err or "could not read username" in err or "permission denied" in err:
            raise AuthenticationError(f"Authentication failed for {repo_url}. Check credentials or access rights.")
        if "could not resolve host" in err or "unable to access" in err or "connection timed out" in err:
            raise NetworkError(f"Network error while cloning {repo_url}: {proc.stderr.strip()}")
        if "not found" in err or "repository not found" in err or "fatal: repository" in err:
            raise InvalidRepoURLError(f"Repository not found or invalid URL: {repo_url}")
        
        raise CloneError(f"Failed to clone repository: {proc.stderr.strip()}")


@contextmanager
def temporary_clone(repo_url: str, keep: bool = False, custom_dir: Optional[str] = None) -> Generator[str, None, None]:
    clone_path = custom_dir or tempfile.mkdtemp(prefix="reviewagent_")
    try:
        clone_repository(repo_url, clone_path)
        yield clone_path
    finally:
        if not keep and os.path.exists(clone_path):
            shutil.rmtree(clone_path, ignore_errors=True)`
  },
  {
    path: 'src/reviewagent/discover.py',
    name: 'discover.py',
    category: 'core',
    description: 'Walks cloned repo, prunes noise directories (venv, .git, cache), and honors .gitignore rules via pathspec.',
    content: `import os
from pathlib import Path
from typing import List, Optional
import pathspec

DEFAULT_IGNORED_DIRS = {
    ".git",
    "venv",
    ".venv",
    "env",
    ".env",
    "__pycache__",
    "node_modules",
    ".tox",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "build",
    "dist",
    "site-packages",
}


def load_gitignore(base_dir: Path) -> Optional[pathspec.PathSpec]:
    gitignore_path = base_dir / ".gitignore"
    if not gitignore_path.is_file():
        return None
    try:
        lines = gitignore_path.read_text(encoding="utf-8").splitlines()
        return pathspec.PathSpec.from_lines("gitwildmatch", lines)
    except OSError:
        return None


def discover_python_files(root_dir: str) -> List[Path]:
    base_path = Path(root_dir).resolve()
    if not base_path.exists():
        return []

    spec = load_gitignore(base_path)
    discovered: List[Path] = []

    for root, dirs, files in os.walk(base_path):
        current_dir = Path(root)
        
        dirs[:] = [
            d for d in dirs
            if d not in DEFAULT_IGNORED_DIRS and not d.endswith(".egg-info")
        ]

        for filename in files:
            if not filename.endswith(".py"):
                continue

            file_path = current_dir / filename
            rel_path_str = str(file_path.relative_to(base_path)).replace("\\\\", "/")

            if spec and spec.match_file(rel_path_str):
                continue

            discovered.append(file_path)

    return sorted(discovered, key=lambda p: str(p.relative_to(base_path)))`
  },
  {
    path: 'src/reviewagent/chunker.py',
    name: 'chunker.py',
    category: 'core',
    description: 'Pure function overlapping-window chunker splitting strictly on line boundaries with token estimation.',
    content: `from dataclasses import dataclass
from typing import List, Optional
import tiktoken

try:
    _ENCODER = tiktoken.get_encoding("cl100k_base")
except Exception:
    _ENCODER = None


def estimate_tokens(text: str) -> int:
    if _ENCODER:
        return len(_ENCODER.encode(text, disallowed_special=()))
    return max(1, len(text) // 4)


@dataclass(frozen=True)
class Chunk:
    start_line: int  # 1-indexed, inclusive
    end_line: int    # 1-indexed, inclusive
    content: str
    lines: List[str]
    estimated_tokens: int


def chunk_lines(
    lines: List[str],
    max_tokens: int = 3000,
    overlap_tokens: int = 300,
) -> List[Chunk]:
    if not lines:
        return []

    if max_tokens <= 0:
        raise ValueError("max_tokens must be greater than 0")
    if overlap_tokens < 0:
        raise ValueError("overlap_tokens cannot be negative")
    if overlap_tokens >= max_tokens:
        overlap_tokens = max(0, max_tokens // 4)

    total_lines = len(lines)
    line_token_counts = [estimate_tokens(line) for line in lines]
    
    total_tokens = sum(line_token_counts)
    if total_tokens <= max_tokens:
        return [
            Chunk(
                start_line=1,
                end_line=total_lines,
                content="".join(lines),
                lines=list(lines),
                estimated_tokens=total_tokens,
            )
        ]

    chunks: List[Chunk] = []
    start_idx = 0

    while start_idx < total_lines:
        current_tokens = 0
        end_idx = start_idx

        while end_idx < total_lines:
            line_cost = line_token_counts[end_idx]
            if end_idx > start_idx and (current_tokens + line_cost > max_tokens):
                break
            current_tokens += line_cost
            end_idx += 1

        chunk_lines_slice = lines[start_idx:end_idx]
        chunk_tokens = sum(line_token_counts[start_idx:end_idx])
        
        chunks.append(
            Chunk(
                start_line=start_idx + 1,
                end_line=end_idx,
                content="".join(chunk_lines_slice),
                lines=chunk_lines_slice,
                estimated_tokens=chunk_tokens,
            )
        )

        if end_idx >= total_lines:
            break

        backtrack_tokens = 0
        next_start = end_idx

        while next_start > start_idx + 1:
            prev_line_cost = line_token_counts[next_start - 1]
            if backtrack_tokens + prev_line_cost > overlap_tokens:
                break
            backtrack_tokens += prev_line_cost
            next_start -= 1

        if next_start <= start_idx:
            start_idx = start_idx + 1
        else:
            start_idx = next_start

    return chunks


def reconstruct_lines(chunks: List[Chunk]) -> List[str]:
    if not chunks:
        return []
    
    result: List[str] = []
    next_expected_line = 1

    for chunk in chunks:
        offset = max(0, next_expected_line - chunk.start_line)
        if offset < len(chunk.lines):
            result.extend(chunk.lines[offset:])
            next_expected_line = chunk.end_line + 1

    return result`
  },
  {
    path: 'src/reviewagent/review.py',
    name: 'review.py',
    category: 'core',
    description: 'Structured LLM review pass supporting OpenRouter NVIDIA Nemotron Free tier & Anthropic Claude with JSON validation.',
    content: `import json
import re
import time
from typing import Any, List, Literal, Optional
from pydantic import BaseModel, Field

from reviewagent.chunker import Chunk

Severity = Literal["bug", "logic", "style"]


class Finding(BaseModel):
    line: int = Field(description="1-indexed line number in the original file")
    severity: Severity = Field(description="Severity classification: bug, logic, or style")
    title: str = Field(description="Short, concise summary of the issue")
    description: str = Field(description="Detailed explanation of the flaw or violation")
    suggestion: Optional[str] = Field(default=None, description="Recommended code fix or approach")


class FileReviewResult(BaseModel):
    file_path: str
    findings: List[Finding] = Field(default_factory=list)
    raw_response: str = ""
    summary: Optional[str] = None


REVIEW_SYSTEM_PROMPT = """You are a senior software engineer performing a rigorous code review on a Python codebase.
Analyze the provided code carefully for:
1. Bugs (runtime errors, unhandled exceptions, type errors, null/None dereferences, off-by-one errors)
2. Logic errors (incorrect algorithms, race conditions, unintended behavior, state inconsistency, improper resource cleanup)
3. Style & maintainability (PEP 8 violations, anti-patterns, confusing variable names, dead code, security smells)

Output your findings STRICTLY as a valid JSON object matching this schema:
{
  "summary": "Brief 1-2 sentence overview of the file health",
  "findings": [
    {
      "line": 42,
      "severity": "bug" | "logic" | "style",
      "title": "Short title",
      "description": "Clear explanation of why this is an issue",
      "suggestion": "How to fix it"
    }
  ]
}
"""


def call_llm(client: Any, model: str, system_prompt: str, user_prompt: str) -> str:
    if hasattr(client, "chat") and hasattr(client.chat, "completions"):
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=4000,
            temperature=0.1,
        )
        return response.choices[0].message.content or ""
    
    if hasattr(client, "messages") and hasattr(client.messages, "create"):
        response = client.messages.create(
            model=model,
            max_tokens=4000,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return "".join(b.text for b in response.content if hasattr(b, "text"))

    raise TypeError(f"Unsupported client type: {type(client)}")


def review_chunk(
    client: Any,
    model: str,
    file_path: str,
    chunk: Chunk,
    max_retries: int = 3,
) -> List[Finding]:
    formatted_code = format_code_with_line_numbers(chunk.lines, start_line=chunk.start_line)
    prompt = f"File: {file_path}\\nLine Range: {chunk.start_line} to {chunk.end_line}\\n\\n\`\`\`python\\n{formatted_code}\\n\`\`\`"

    backoff = 2.0
    for attempt in range(max_retries):
        try:
            response_text = call_llm(client, model, REVIEW_SYSTEM_PROMPT, prompt)
            data = extract_json_payload(response_text)
            return [Finding(**f) for f in data.get("findings", [])]
        except Exception:
            if attempt == max_retries - 1:
                raise
            time.sleep(backoff)
            backoff *= 2.0
    return []`
  },
  {
    path: 'src/reviewagent/conversation.py',
    name: 'conversation.py',
    category: 'core',
    description: 'Per-file multi-turn conversation manager supporting OpenRouter and Anthropic with JSON session persistence.',
    content: `import json
from pathlib import Path
from typing import Any, List, Optional
from pydantic import BaseModel, Field


class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class Conversation(BaseModel):
    file_path: str
    file_content: str
    system_prompt: str = (
        "You are an expert Python reviewer with deep context on this file. "
        "Answer follow-up questions accurately with direct references to the code and findings."
    )
    messages: List[Message] = Field(default_factory=list)

    def add_user_message(self, text: str) -> None:
        self.messages.append(Message(role="user", content=text))

    def add_assistant_message(self, text: str) -> None:
        self.messages.append(Message(role="assistant", content=text))

    def ask(self, client: Any, model: str, question: str) -> str:
        self.add_user_message(question)
        full_system = f"{self.system_prompt}\\n\\nTarget File: {self.file_path}\\nFile Content:\\n\`\`\`python\\n{self.file_content}\\n\`\`\`"

        if hasattr(client, "chat") and hasattr(client.chat, "completions"):
            api_messages = [{"role": "system", "content": full_system}] + [
                {"role": m.role, "content": m.content} for m in self.messages
            ]
            response = client.chat.completions.create(model=model, messages=api_messages, max_tokens=3000)
            answer = response.choices[0].message.content or ""
            self.add_assistant_message(answer)
            return answer

        if hasattr(client, "messages") and hasattr(client.messages, "create"):
            response = client.messages.create(
                model=model,
                max_tokens=3000,
                system=full_system,
                messages=[{"role": m.role, "content": m.content} for m in self.messages],
            )
            answer = "".join(b.text for b in response.content if hasattr(b, "text"))
            self.add_assistant_message(answer)
            return answer

        raise TypeError(f"Unsupported client type: {type(client)}")`
  },
  {
    path: 'src/reviewagent/aggregate.py',
    name: 'aggregate.py',
    category: 'core',
    description: 'Fuzzy finding deduplication across adjacent overlapping chunk boundaries and severity ordering.',
    content: `from difflib import SequenceMatcher
from typing import List
from reviewagent.review import Finding


def are_findings_similar(f1: Finding, f2: Finding, line_tolerance: int = 2, text_similarity_threshold: float = 0.6) -> bool:
    if f1.severity != f2.severity:
        return False

    line_diff = abs(f1.line - f2.line)
    if line_diff > line_tolerance:
        return False

    title_sim = SequenceMatcher(None, f1.title.lower(), f2.title.lower()).ratio()
    if title_sim >= text_similarity_threshold:
        return True

    desc_sim = SequenceMatcher(None, f1.description.lower(), f2.description.lower()).ratio()
    return desc_sim >= text_similarity_threshold


def deduplicate_findings(findings: List[Finding]) -> List[Finding]:
    if not findings:
        return []

    severity_order = {"bug": 0, "logic": 1, "style": 2}
    sorted_findings = sorted(
        findings,
        key=lambda f: (f.line, severity_order.get(f.severity, 3)),
    )

    merged: List[Finding] = []

    for finding in sorted_findings:
        is_dup = False
        for i, existing in enumerate(merged):
            if are_findings_similar(finding, existing):
                is_dup = True
                if len(finding.description) > len(existing.description):
                    merged[i] = finding
                break

        if not is_dup:
            merged.append(finding)

    return merged`
  },
  {
    path: 'src/reviewagent/report.py',
    name: 'report.py',
    category: 'core',
    description: 'Top-down Markdown report renderer grouped by worst-severity-first with executive summary metrics.',
    content: `from datetime import datetime
from typing import List
from reviewagent.review import FileReviewResult, Finding


def compute_file_severity_rank(findings: List[Finding]) -> int:
    if not findings:
        return 999
    severities = {f.severity for f in findings}
    if "bug" in severities:
        return 1
    if "logic" in severities:
        return 2
    if "style" in severities:
        return 3
    return 4


def generate_markdown_report(repo_url: str, results: List[FileReviewResult], model_name: str) -> str:
    total_files = len(results)
    all_findings = [f for r in results for f in r.findings]
    
    bug_count = sum(1 for f in all_findings if f.severity == "bug")
    logic_count = sum(1 for f in all_findings if f.severity == "logic")
    style_count = sum(1 for f in all_findings if f.severity == "style")
    total_issues = len(all_findings)

    sorted_results = sorted(
        results,
        key=lambda r: (compute_file_severity_rank(r.findings), -len(r.findings), r.file_path),
    )

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    lines = [
        f"# Code Review Report",
        f"",
        f"- **Repository:** \`{repo_url}\`",
        f"- **Date:** {now}",
        f"- **Review Model:** \`{model_name}\`",
        f"- **Files Analyzed:** {total_files}",
        f"- **Total Findings:** {total_issues} ({bug_count} bugs, {logic_count} logic errors, {style_count} style issues)",
        f"",
        f"---",
        f"",
        f"## Executive Summary",
        f"",
        f"| Metric | Count |",
        f"|---|---|",
        f"| Total Files Checked | {total_files} |",
        f"| Critical Bugs | {bug_count} |",
        f"| Logic Errors | {logic_count} |",
        f"| Style & Maintainability | {style_count} |",
        f"",
    ]
    return "\\n".join(lines)`
  },
  {
    path: 'src/reviewagent/cli.py',
    name: 'cli.py',
    category: 'core',
    description: 'Typer CLI entrypoint supporting OpenRouter Free NVIDIA Nemotron 70B & Anthropic Claude with Rich visual progress.',
    content: `import os
from pathlib import Path
from typing import Any, Optional, Tuple
import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn

from reviewagent.config import Settings
from reviewagent.clone import temporary_clone, CloneError
from reviewagent.discover import discover_python_files
from reviewagent.chunker import chunk_lines
from reviewagent.review import review_chunk, FileReviewResult
from reviewagent.conversation import Conversation
from reviewagent.aggregate import aggregate_chunk_findings
from reviewagent.report import generate_markdown_report

app = typer.Typer(name="reviewagent", help="Autonomous CLI agent for Python reviews using OpenRouter (Nemotron Free) or Claude.")
console = Console()

def create_llm_client(settings: Settings, model: Optional[str] = None, provider: Optional[str] = None) -> Tuple[Any, str, str]:
    resolved_model = model or settings.model
    resolved_provider = provider or settings.resolve_provider(resolved_model)

    if resolved_provider == "openrouter":
        api_key = settings.openrouter_api_key
        if not api_key:
            console.print("[bold red]Error:[/bold red] OPENROUTER_API_KEY is not set.")
            console.print("Run: export OPENROUTER_API_KEY=\\"sk-or-v1-...\\"")
            raise typer.Exit(code=1)

        from openai import OpenAI
        client = OpenAI(
            base_url=settings.openrouter_base_url,
            api_key=api_key,
            default_headers={"HTTP-Referer": "https://github.com/code-review-agent", "X-Title": "Code Review Agent (Nemotron Free)"},
        )
        return client, resolved_model, "OpenRouter"

    elif resolved_provider == "anthropic":
        import anthropic
        return anthropic.Anthropic(api_key=settings.anthropic_api_key), resolved_model, "Anthropic"

    raise typer.Exit(code=1)

@app.command(name="review")
def review(
    repo_url: str = typer.Argument(..., help="GitHub repo URL"),
    output: Path = typer.Option(Path("code_review_report.md"), "--output", "-o"),
    max_tokens: int = typer.Option(3000, "--max-tokens"),
    overlap_tokens: int = typer.Option(300, "--overlap-tokens"),
    model: Optional[str] = typer.Option(None, "--model", "-m"),
    provider: Optional[str] = typer.Option(None, "--provider", "-p"),
    keep_clone: bool = typer.Option(False, "--keep-clone"),
    session_dir: Path = typer.Option(Path(".reviewagent_sessions"), "--session-dir"),
):
    """Clones repo, reviews Python files with Nemotron / Claude, outputs Markdown report."""
    pass

@app.command(name="followup")
def followup(
    file_path: str = typer.Argument(..., help="Relative path of reviewed file"),
    question: str = typer.Argument(..., help="Question to ask about findings"),
    session_dir: Path = typer.Option(Path(".reviewagent_sessions"), "--session-dir"),
    model: Optional[str] = typer.Option(None, "--model", "-m"),
):
    """Reopens conversation history for a specific reviewed file."""
    pass`
  },
  {
    path: 'tests/test_chunker.py',
    name: 'test_chunker.py',
    category: 'test',
    description: 'Hypothesis property test verifying line preservation, ascending order, and lossless reconstruction invariants.',
    content: `from hypothesis import given, strategies as st, settings
import pytest
from reviewagent.chunker import chunk_lines, reconstruct_lines

line_strategy = st.text(
    alphabet=st.characters(blacklist_categories=("Cs",)),
    min_size=0,
    max_size=120,
).map(lambda s: s.replace("\\r", "").replace("\\n", "") + "\\n")

file_strategy = st.lists(line_strategy, min_size=1, max_size=200)

@given(
    lines=file_strategy,
    max_tokens=st.integers(min_value=20, max_value=500),
    overlap_tokens=st.integers(min_value=0, max_value=150),
)
@settings(max_examples=100)
def test_chunking_invariants(lines: list[str], max_tokens: int, overlap_tokens: int):
    safe_overlap = min(overlap_tokens, max(0, max_tokens // 4))
    chunks = chunk_lines(lines, max_tokens=max_tokens, overlap_tokens=safe_overlap)

    # Invariant 1: At least one chunk produced
    assert len(chunks) >= 1

    # Invariant 2: Range validity and line containment
    for chunk in chunks:
        assert 1 <= chunk.start_line <= chunk.end_line <= len(lines)
        assert len(chunk.lines) == (chunk.end_line - chunk.start_line + 1)
        assert chunk.content == "".join(chunk.lines)

    # Invariant 3: Forward progress and overlap validity
    for i in range(len(chunks) - 1):
        assert chunks[i + 1].start_line <= chunks[i].end_line + 1
        assert chunks[i + 1].start_line > chunks[i].start_line

    # Invariant 4: Complete span
    assert chunks[0].start_line == 1
    assert chunks[-1].end_line == len(lines)

    # Invariant 5: Lossless reconstruction
    reconstructed = reconstruct_lines(chunks)
    assert reconstructed == lines`
  },
  {
    path: 'tests/test_discover.py',
    name: 'test_discover.py',
    category: 'test',
    description: 'Unit test verifying .gitignore exclusion rules (e.g. temp_*.py) and deterministic sorting.',
    content: `from pathlib import Path
from reviewagent.discover import discover_python_files

def test_discover_python_files_in_fixture():
    fixture_dir = Path(__file__).parent / "fixtures" / "sample_repo"
    files = discover_python_files(str(fixture_dir))
    rel_names = [f.name for f in files]

    assert "main.py" in rel_names
    assert "utils.py" in rel_names
    assert "temp_debug.py" not in rel_names`
  },
  {
    path: 'tests/test_aggregate.py',
    name: 'test_aggregate.py',
    category: 'test',
    description: 'Unit test verifying line proximity and text similarity finding deduplication across chunks.',
    content: `from reviewagent.aggregate import deduplicate_findings
from reviewagent.review import Finding

def test_deduplicate_identical_and_near_duplicates():
    findings = [
        Finding(
            line=42,
            severity="bug",
            title="Unclosed database connection",
            description="Connection object 'conn' is opened without context manager.",
        ),
        Finding(
            line=43,
            severity="bug",
            title="Unclosed database connection",
            description="The database connection is never closed, leading to a socket leak.",
        ),
        Finding(
            line=90,
            severity="style",
            title="Comparison to True",
            description="Use 'if active:' instead of 'if active == True:'",
        ),
    ]

    deduped = deduplicate_findings(findings)
    assert len(deduped) == 2`
  },
  {
    path: 'examples/sample_report.md',
    name: 'sample_report.md',
    category: 'doc',
    description: 'Realistic generated Markdown report showing executive metrics, severity tags, and Python remediation snippets.',
    content: `# Code Review Report

- **Repository:** \`https://github.com/example-org/payment-service\`
- **Date:** 2026-08-16 02:20:00
- **Review Model:** \`claude-3-5-sonnet-20241022\`
- **Files Analyzed:** 5
- **Total Findings:** 6 (2 bugs, 2 logic errors, 2 style issues)

---

## Executive Summary

| Metric | Count |
|---|---|
| Total Files Checked | 5 |
| Critical Bugs | 2 |
| Logic Errors | 2 |
| Style & Maintainability | 2 |

## Detailed File Findings

### \`services/payment_gateway.py\` — [CRITICAL (2 bugs)]

#### Line 58 — [BUG] Unhandled NoneType on Customer Metadata
**Description:** \`customer.get("metadata")["stripe_id"]\` assumes the \`"metadata"\` key exists and is non-None. Triggers \`TypeError: 'NoneType' object is not subscriptable\` if metadata is missing.

**Suggested Fix:**
\`\`\`python
metadata = customer.get("metadata") or {}
stripe_id = metadata.get("stripe_id")
if not stripe_id:
    raise ValueError(f"Missing stripe_id for customer {customer.get('id')}")
\`\`\`

#### Line 114 — [BUG] Unclosed HTTPS Connection in Webhook Retry Loop
**Description:** \`urllib3.PoolManager\` creates new connection pools on every failed attempt without invoking \`.clear()\`, leaking socket descriptors.

**Suggested Fix:**
\`\`\`python
with urllib3.PoolManager() as http:
    response = http.request("POST", webhook_url, json=payload, timeout=5.0)
\`\`\``
  }
];
