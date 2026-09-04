# code-review-agent

A command-line tool that clones a GitHub repository, walks all Python files, chunks oversized files using line-boundary sliding windows, performs structured code reviews via OpenRouter (NVIDIA Nemotron Free tier) or Anthropic Claude, and outputs an aggregated Markdown report with per-file conversational follow-ups.

## Features

- **OpenRouter Free Tier Integration**: Native support for **NVIDIA Nemotron 70B Free** (`nvidia/llama-3.1-nemotron-70b-instruct:free`) and other open weights without API cost.
- **Anthropic Claude Support**: Multi-provider fallback to `claude-3-5-sonnet-20241022`.
- **Line-Boundary Overlapping Windows**: Zero split tokens mid-statement, verified by Hypothesis property-based testing.
- **Deduplication & Severity Sorting**: Aggregates overlapping chunk findings and sorts files worst-severity-first.
- **Interactive Multi-Turn REPL**: Grounded per-file follow-up queries using persisted conversation histories.

---

## Architecture

```
   GitHub repo URL
        │
        ▼
   [1] Clone (shallow clone via subprocess + git into temp directory)
        │
        ▼
   [2] Enumerate (os.walk, filter .py, honor .gitignore via pathspec)
        │
        ▼
   [3] Chunk (line-boundary overlapping windows using token proxy)
        │
        ▼
   [4] Review Loop (OpenRouter Nemotron / Anthropic structured JSON review)
        │
        ▼
   [5] Aggregate (merge chunked results, deduplicate boundary findings)
        │
        ▼
   [6] Markdown Report (ordered by worst-severity-first)
        │
        ▼
   [7] Interactive Follow-up (reopen conversation session per file)
```

## Requirements

- Python 3.11+
- Git CLI on PATH
- **OpenRouter API Key** (`OPENROUTER_API_KEY`) for Free NVIDIA Nemotron 70B, or **Anthropic API Key** (`ANTHROPIC_API_KEY`)

## Installation

```bash
git clone https://github.com/your-username/code-review-agent.git
cd code-review-agent

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install package in editable mode with dev dependencies
pip install -e ".[dev]"
```

## Run the web app locally

This project runs as a regular Vite/Express application and does not require AI Studio.

```bash
npm install
copy .env.example .env  # Windows PowerShell: Copy-Item .env.example .env
npm run dev
```

Open http://localhost:3000 in your browser. Put your real `GEMINI_API_KEY` or
`OPENROUTER_API_KEY` only in `.env`; `.env` is ignored by Git.

To publish the source on GitHub, commit `.env.example`, but never commit `.env`.

## Configuration

Set your API key in your environment or in a local `.env` file:

### Option A: OpenRouter Free NVIDIA Nemotron 70B (Recommended)
```bash
# 1. Get a free API key at https://openrouter.ai/keys
export OPENROUTER_API_KEY="sk-or-v1-..."

# Default model is nvidia/llama-3.1-nemotron-70b-instruct:free
```

### Option B: Anthropic Claude
```bash
export ANTHROPIC_API_KEY="sk-ant-api03-..."
```

## Usage

### 1. Run a full repository review

Review all Python files in a repository with the OpenRouter Nemotron Free model:

```bash
# Default uses nvidia/llama-3.1-nemotron-70b-instruct:free via OpenRouter
reviewagent review https://github.com/pallets/click.git
```

Custom options:

```bash
# Explicitly specifying model and output report
reviewagent review https://github.com/encode/httpx.git \
  --output ./httpx_report.md \
  --model nvidia/llama-3.1-nemotron-70b-instruct:free \
  --max-tokens 3000 \
  --overlap-tokens 300 \
  --keep-clone
```

Flags:
- `--output, -o`: Path to the generated Markdown report (default: `code_review_report.md`).
- `--model, -m`: LLM model identifier (default: `nvidia/llama-3.1-nemotron-70b-instruct:free` or `claude-3-5-sonnet-20241022`).
- `--provider, -p`: Provider override (`openrouter` or `anthropic`, auto-detected by default).
- `--max-tokens`: Approximate token budget per chunk before splitting (default: `3000`).
- `--overlap-tokens`: Overlap budget between adjacent chunks (default: `300`).
- `--keep-clone`: Retains the cloned repository on disk for manual inspection.
- `--session-dir`: Directory storing serialized conversation sessions (default: `.reviewagent_sessions`).

### 2. Ask follow-up questions for a specific file

Reopen the review conversation history for any reviewed file using Nemotron:

```bash
reviewagent followup "src/httpx/_client.py" "Why is the connection pool cleanup flagged as a leak on line 180?"
```

## Testing

Run unit tests and Hypothesis property-based tests:

```bash
pytest -v
```

### Property-Based Invariant Testing

The chunking engine (`src/reviewagent/chunker.py`) is verified using Hypothesis in `tests/test_chunker.py`. It tests three core invariants across hundreds of randomized text streams:
1. **Line integrity**: Chunks split *strictly* on line boundaries — no line is split mid-content.
2. **Order preservation**: Chunks maintain strict ascending line numbering without gaps.
3. **Lossless reconstruction**: Recombining chunks by trimming duplicate overlaps exactly reproduces the original file byte-for-byte and line-for-line.

## Project Structure

```
code-review-agent/
├── pyproject.toml              # Hatchling build & dependencies (openai, anthropic, typer)
├── README.md                   # Full architecture & CLI manual
├── .env.example                # Environment variables template
├── src/
│   └── reviewagent/
│       ├── __init__.py
│       ├── config.py           # pydantic-settings (OpenRouter Nemotron + Anthropic)
│       ├── clone.py            # subprocess git clone & tempdir handling
│       ├── discover.py         # os.walk + pathspec .gitignore filtering
│       ├── chunker.py          # line-boundary overlapping window chunker
│       ├── review.py           # Multi-provider LLM review (OpenRouter / Anthropic)
│       ├── conversation.py     # per-file multi-turn conversation store
│       ├── aggregate.py        # merge chunk findings & deduplicate overlap
│       ├── report.py           # Markdown report generator
│       └── cli.py              # Typer CLI (review + followup commands)
├── tests/
│   ├── fixtures/
│   │   └── sample_repo/        # fixture repo for discovery & review tests
│   ├── test_chunker.py         # Hypothesis property-based tests
│   ├── test_discover.py        # unit tests for file discovery & gitignore
│   └── test_aggregate.py       # unit tests for finding deduplication
└── examples/
    └── sample_report.md        # sample generated review report
```

