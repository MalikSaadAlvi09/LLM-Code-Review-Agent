<div align="center">











An AI-powered code-review pipeline for Python repositories—built for actionable findings, stable chunking, and contextual follow-up conversations.

Quick start · Architecture · CLI reference · Testing · Roadmap

</div>

Overview

code-review-agent clones a GitHub repository, discovers its Python source files, breaks oversized files into line-safe overlapping windows, sends those windows to an AI reviewer, and combines the findings into a severity-ranked Markdown report.

Every reviewed file also receives a persisted conversation context, allowing developers to ask targeted follow-up questions without losing the evidence behind the original review.

[!IMPORTANT]
Model availability, pricing, context limits, and free-tier policies are controlled by the selected provider and can change. Confirm the current model identifier before running a large review.

Why this project

Challenge

How Code Review Agent handles it

Large files exceed model context limits

Splits source at line boundaries using configurable overlapping windows

Overlap can produce duplicate findings

Normalizes and deduplicates findings during aggregation

Long reports hide urgent problems

Sorts results by worst severity first

One-shot reviews lack explanation

Persists per-file sessions for grounded follow-up questions

Providers differ in cost and availability

Supports OpenRouter and Anthropic through a provider-aware review layer

Chunking bugs silently lose code

Verifies line integrity, order, and reconstruction with property-based tests

Core capabilities

Multi-provider AI review — use an OpenRouter-hosted model or Anthropic Claude.

Repository-aware discovery — walks Python files while respecting .gitignore rules through pathspec.

Line-safe chunking — never cuts a source line in the middle.

Sliding-window context — preserves nearby code across adjacent chunks.

Structured findings — captures severity, location, category, explanation, and remediation.

Finding aggregation — merges overlapping results and removes repeated issues.

Severity-first reports — surfaces the highest-risk files and findings first.

Conversational follow-ups — reopens the stored review context for a specific file.

Property-based verification — stress-tests chunking invariants with randomized inputs.

Architecture

flowchart TD
    A["GitHub repository URL"] --> B["Shallow clone"]
    B --> C["Discover Python files"]
    C --> D["Line-safe overlapping chunks"]
    D --> E{"AI provider"}
    E -->|OpenRouter| F["Structured review"]
    E -->|Anthropic| F
    F --> G["Merge and deduplicate"]
    G --> H["Severity-ranked Markdown report"]
    F --> I["Per-file session history"]
    I --> J["Grounded follow-up REPL"]

Review lifecycle

sequenceDiagram
    actor Developer
    participant CLI
    participant Repository
    participant Reviewer as AI Reviewer
    participant Report

    Developer->>CLI: review repository URL
    CLI->>Repository: shallow clone and discover files
    loop Each file and chunk
        CLI->>Reviewer: source context + review schema
        Reviewer-->>CLI: structured findings
    end
    CLI->>CLI: deduplicate and prioritize
    CLI->>Report: write Markdown report
    Report-->>Developer: actionable review summary

Review pipeline

Clone — performs a shallow Git clone in a temporary directory.

Discover — walks the repository, selects .py files, and applies .gitignore rules.

Chunk — creates overlapping windows without splitting source lines.

Review — requests structured findings from the configured AI provider.

Aggregate — merges chunk results and removes boundary duplicates.

Prioritize — orders files and findings from highest to lowest severity.

Report — generates a portable Markdown review.

Follow up — restores a file-specific conversation for deeper investigation.

Requirements

Python 3.11+

Git available on PATH

An API key for at least one supported provider:

OPENROUTER_API_KEY

ANTHROPIC_API_KEY

Node.js and npm only if you intend to run the optional web interface

Quick start

1. Clone and install the CLI

git clone https://github.com/MalikSaadAlvi09/code-review-agent.git
cd code-review-agent

python -m venv .venv

Activate the environment:

# macOS / Linux
source .venv/bin/activate

# Windows PowerShell
.venv\Scripts\Activate.ps1

Install the package with development dependencies:

python -m pip install --upgrade pip
pip install -e ".[dev]"

2. Configure a provider

Copy the safe template and add your key locally:

# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env

Then set one provider key in .env:

# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Or Anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here

[!CAUTION]
Never commit .env or expose a real API key in screenshots, issues, logs, or generated reports. Commit only .env.example.

3. Review a repository

reviewagent review https://github.com/pallets/click.git

The default report is written to code_review_report.md.

Provider configuration

OpenRouter

export OPENROUTER_API_KEY="sk-or-v1-..."

Example with an explicit model:

reviewagent review https://github.com/encode/httpx.git \
  --provider openrouter \
  --model nvidia/nemotron-3-super-120b-a12b:free

Browse the OpenRouter model catalog before a large run to confirm current pricing, privacy terms, and availability.

Anthropic

export ANTHROPIC_API_KEY="sk-ant-..."

reviewagent review https://github.com/encode/httpx.git \
  --provider anthropic \
  --model claude-sonnet-5

Use Anthropic's current model overview when changing the configured model.

CLI reference

Run a full review

reviewagent review https://github.com/encode/httpx.git \
  --output ./httpx_report.md \
  --provider openrouter \
  --model nvidia/nemotron-3-super-120b-a12b:free \
  --max-tokens 3000 \
  --overlap-tokens 300 \
  --keep-clone

Option

Purpose

Default

--output, -o

Generated Markdown report path

code_review_report.md

--provider, -p

openrouter or anthropic

Auto-detected

--model, -m

Provider model identifier

Provider-specific

--max-tokens

Approximate token budget per chunk

3000

--overlap-tokens

Context overlap between adjacent chunks

300

--keep-clone

Preserve the temporary clone for inspection

Disabled

--session-dir

Location for serialized file conversations

.reviewagent_sessions

Ask a file-specific follow-up

reviewagent followup \
  "src/httpx/_client.py" \
  "Why was the connection-pool cleanup flagged as a leak near line 180?"

The follow-up command restores the conversation created during the original review, keeping the answer tied to the file and earlier findings.

Example report

# Code Review Report

## Summary
- Files reviewed: 42
- Critical: 1
- High: 3
- Medium: 8
- Low: 14

## Critical — src/payments/service.py

### Untrusted input reaches a shell command
- Severity: Critical
- Lines: 81–86
- Category: Security
- Explanation: User-controlled input is interpolated into a shell command.
- Recommendation: Replace shell execution with an argument list and strict validation.

Optional web interface

If your checkout includes the Vite/Express dashboard (package.json), run it locally with:

npm install

# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env

npm run dev

Open http://localhost:3000.

The web application should read secrets only from the local .env file or a secure deployment environment. Never place provider keys in browser-delivered source code.

Testing

Run the complete test suite:

pytest -v

Run only the chunker property tests:

pytest tests/test_chunker.py -v

Verified chunking invariants

Invariant

Guarantee

Line integrity

No source line is split mid-content

Order preservation

Source lines remain in ascending order

Lossless reconstruction

Removing repeated overlap reconstructs the original file exactly

Hypothesis generates randomized source streams to test these properties across ordinary and adversarial inputs.

Project structure

code-review-agent/
├── pyproject.toml
├── README.md
├── .env.example
├── src/
│   └── reviewagent/
│       ├── __init__.py
│       ├── config.py
│       ├── clone.py
│       ├── discover.py
│       ├── chunker.py
│       ├── review.py
│       ├── conversation.py
│       ├── aggregate.py
│       ├── report.py
│       └── cli.py
├── tests/
│   ├── fixtures/
│   │   └── sample_repo/
│   ├── test_chunker.py
│   ├── test_discover.py
│   └── test_aggregate.py
└── examples/
    └── sample_report.md

<details>
<summary><strong>Module responsibilities</strong></summary>

Module

Responsibility

config.py

Loads provider, model, limits, and environment configuration

clone.py

Manages shallow cloning and temporary repository cleanup

discover.py

Finds Python files and applies ignore rules

chunker.py

Builds line-safe windows with deterministic overlap

review.py

Calls providers and validates structured review responses

conversation.py

Persists and restores per-file review conversations

aggregate.py

Combines chunk findings and removes duplicates

report.py

Renders the severity-ranked Markdown report

cli.py

Exposes the review and followup commands

</details>

Security and privacy

Reviewed source code is sent to the AI provider selected for that run.

Do not review repositories containing secrets until those secrets have been removed or redacted.

Use least-privilege API keys and rotate any credential that may have been exposed.

Treat AI findings as engineering guidance, not as proof that a codebase is secure.

Validate high-impact findings manually before changing production systems.

Limitations

The agent currently targets Python source files.

Results depend on the selected model, prompt, repository context, and provider limits.

Static review cannot fully reproduce runtime behavior or guarantee vulnerability detection.

Findings can contain false positives or miss defects; human validation remains essential.

Roadmap

GitHub pull-request review comments

SARIF export for code-scanning tools

Additional language parsers

Incremental reviews based on Git diffs

Configurable review policies and severity gates

Token and cost estimates before submission

Local-model provider support

Web dashboard review history and team collaboration

Contributing

Contributions are welcome.

Fork the repository.

Create a focused branch: git checkout -b feat/your-feature.

Add or update tests with your change.

Run pytest -v.

Commit with a clear message.

Open a pull request describing the behavior and tradeoffs.

Please avoid mixing unrelated changes in the same pull request.

License

Add a LICENSE file before distributing the project publicly, then replace the license badge at the top of this README with the selected license.

Acknowledgements

Built with Python, Typer, Pydantic Settings, PathSpec, Pytest, Hypothesis, OpenRouter, and Anthropic.

<div align="center">

Turn repository noise into a prioritized engineering plan.



</div>
