<div align="center">

<img src="./hero-banner.svg" alt="Code Review Agent — cinematic banner" width="100%"/>

<br/><br/>

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&duration=2800&pause=900&color=58A6FF&center=true&vCenter=true&width=780&lines=Clone+%E2%86%92+Chunk+%E2%86%92+Review+%E2%86%92+Aggregate+%E2%86%92+Report;Powered+by+NVIDIA+Nemotron+70B+%7C+Free+Tier;Line-Boundary+Chunking+%7C+Hypothesis-Verified;Multi-Turn+Conversational+Follow-ups" alt="Typing SVG" />

<br/><br/>

[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-Nemotron%2070B%20Free-6C4EFF?style=for-the-badge)](https://openrouter.ai/)
[![Anthropic](https://img.shields.io/badge/Anthropic-Claude%203.5%20Sonnet-D97757?style=for-the-badge&logo=anthropic&logoColor=white)](https://www.anthropic.com/)
[![Tests](https://img.shields.io/badge/Tests-Hypothesis%20Verified-2ea44f?style=for-the-badge&logo=pytest&logoColor=white)](#-testing)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg?style=for-the-badge)](#-contributing)

<br/>

[![Windows](https://img.shields.io/badge/Windows-0078D6?style=flat-square&logo=windows11&logoColor=white)](#-windows)
[![macOS](https://img.shields.io/badge/macOS-000000?style=flat-square&logo=apple&logoColor=white)](#-macos)
[![Linux](https://img.shields.io/badge/Linux-FCC624?style=flat-square&logo=linux&logoColor=black)](#-linux)

<sub>⭐ If this project saves you a code review, consider starring it — it genuinely helps.</sub>

</div>

<br/>

> **code-review-agent** clones a GitHub repository, walks every Python file, splits oversized files into overlapping line-boundary chunks, sends each chunk through a structured LLM review pipeline (NVIDIA Nemotron 70B via OpenRouter — **free** — or Anthropic Claude), then aggregates the findings into a single, severity-sorted Markdown report you can interrogate afterward with grounded, per-file follow-up questions.

<br/>

<div align="center">
<img src="./terminal-demo.svg" alt="Live terminal demo — repository discovery, AI review, deduplication, report generation" width="100%"/>
<sub><i>A real run: clone → discover → review → merge → severity signal → report, end to end.</i></sub>
</div>

<br/>

## 📚 Table of Contents

<table>
<tr>
<td width="50%" valign="top">

- [✨ Features](#-features)
- [🏗️ Architecture](#️-architecture)
- [⚙️ Requirements](#️-requirements)
- [📦 Installation & Setup Guide](#-installation--setup-guide)
  - [🪟 Windows](#-windows)
  - [🍎 macOS](#-macos)
  - [🐧 Linux](#-linux)
- [🖥️ Run the Web App Locally](#️-run-the-web-app-locally)

</td>
<td width="50%" valign="top">

- [🔑 Configuration](#-configuration)
- [🚀 Usage](#-usage)
- [🧪 Testing](#-testing)
- [📁 Project Structure](#-project-structure)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

</td>
</tr>
</table>

<br/>

## ✨ Features

<table>
<tr>
<td width="33%" valign="top">

### 🆓 Free-Tier First
Native support for **NVIDIA Nemotron 70B**
(`nvidia/llama-3.1-nemotron-70b-instruct:free`)
via OpenRouter — zero API cost by default.

</td>
<td width="33%" valign="top">

### 🔀 Multi-Provider
Seamless fallback to **Anthropic Claude**
(`claude-3-5-sonnet-20241022`) when you
need a heavier-weight reviewer.

</td>
<td width="33%" valign="top">

### 🧩 Lossless Chunking
Line-boundary **overlapping sliding windows**
— zero split tokens mid-statement, verified
with Hypothesis property-based testing.

</td>
</tr>
<tr>
<td width="33%" valign="top">

### 🧹 Smart Aggregation
Deduplicates overlapping chunk findings and
sorts files **worst-severity-first** so the
report reads top-down by urgency.

</td>
<td width="33%" valign="top">

### 💬 Conversational Follow-ups
Reopen a **grounded, multi-turn** REPL
session per file — ask "why?" and get
answers anchored to the original review.

</td>
<td width="33%" valign="top">

### 📝 Clean Markdown Reports
A single, portable `.md` report — readable
in any editor, renders natively on GitHub,
zero external viewer required.

</td>
</tr>
</table>

<br/>

## 🏗️ Architecture

```mermaid
flowchart TD
    A(["🔗 GitHub Repository URL"]) --> B["1️⃣ Clone<br/><sub>shallow git clone → temp directory</sub>"]
    B --> C["2️⃣ Enumerate<br/><sub>os.walk · filter *.py · honor .gitignore via pathspec</sub>"]
    C --> D["3️⃣ Chunk<br/><sub>line-boundary overlapping windows · token-budget proxy</sub>"]
    D --> E{"4️⃣ Review Loop"}
    E -->|"free tier"| F["🟢 OpenRouter<br/>NVIDIA Nemotron 70B"]
    E -->|"fallback"| G["🟣 Anthropic<br/>Claude 3.5 Sonnet"]
    F --> H["5️⃣ Aggregate<br/><sub>merge chunk results · dedupe boundary findings</sub>"]
    G --> H
    H --> I["6️⃣ Markdown Report<br/><sub>ordered worst-severity-first</sub>"]
    I --> J(["7️⃣ Interactive Follow-up<br/><sub>reopen per-file conversation session</sub>"])

    classDef stage fill:#161b22,stroke:#58A6FF,stroke-width:1.5px,color:#c9d1d9,rx:8,ry:8
    classDef terminal fill:#0F2027,stroke:#2ea44f,stroke-width:2px,color:#ffffff,rx:20,ry:20
    classDef decision fill:#21262d,stroke:#D97757,stroke-width:1.5px,color:#c9d1d9
    class A,J terminal
    class B,C,D,H,I stage
    class E decision
    class F,G stage
```

<sub>💡 GitHub renders this diagram natively — no plugins required.</sub>

<br/>

## ⚙️ Requirements

| Requirement | Details |
|---|---|
| 🐍 **Python** | 3.11+ |
| 🌿 **Git** | Available on `PATH` |
| 🔑 **API Key** | `OPENROUTER_API_KEY` *(free NVIDIA Nemotron 70B)* **or** `ANTHROPIC_API_KEY` |
| 💻 **OS** | Windows 10/11 · macOS 12+ (Intel & Apple Silicon) · Any modern Linux distro |

<br/>

## 📦 Installation & Setup Guide

<div align="center">
<img src="./platforms-banner.svg" alt="Cross-platform setup — Windows, macOS, Linux" width="100%"/></div>

<br/>

Pick your operating system below — each guide is self-contained, from a clean machine to a working `reviewagent` command.

<br/>

### 🪟 Windows

<details open>
<summary><b>Windows 10 / 11 — PowerShell setup</b></summary>

<br/>

**1. Install prerequisites** *(skip anything you already have)*

```powershell
# Using winget (built into Windows 10/11)
winget install --id Python.Python.3.11 -e
winget install --id Git.Git -e
```

> No `winget`? Download Python from [python.org/downloads](https://www.python.org/downloads/) and Git from [git-scm.com](https://git-scm.com/download/win) instead. During Python setup, **check "Add python.exe to PATH."**

**2. Clone the repository**

```powershell
git clone https://github.com/your-username/code-review-agent.git
cd code-review-agent
```

**3. Create and activate a virtual environment**

```powershell
python -m venv .venv
.venv\Scripts\activate
```

> If activation fails with an execution-policy error, run PowerShell as Administrator once:
> `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

**4. Install the package**

```powershell
pip install -e ".[dev]"
```

**5. Verify**

```powershell
reviewagent --help
```

</details>

<br/>

### 🍎 macOS

<details>
<summary><b>macOS 12+ — Intel & Apple Silicon</b></summary>

<br/>

**1. Install prerequisites via [Homebrew](https://brew.sh)**

```bash
# Install Homebrew if you don't already have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install python@3.11 git
```

**2. Clone the repository**

```bash
git clone https://github.com/your-username/code-review-agent.git
cd code-review-agent
```

**3. Create and activate a virtual environment**

```bash
python3.11 -m venv .venv
source .venv/bin/activate
```

**4. Install the package**

```bash
pip install -e ".[dev]"
```

**5. Verify**

```bash
reviewagent --help
```

> ⚙️ **Apple Silicon (M1/M2/M3/M4) note:** everything here runs natively under arm64 — no Rosetta required for this project's pure-Python dependency set.

</details>

<br/>

### 🐧 Linux

<details>
<summary><b>Debian / Ubuntu · Fedora / RHEL · Arch</b></summary>

<br/>

**1. Install prerequisites**

```bash
# Debian / Ubuntu
sudo apt update && sudo apt install -y python3.11 python3.11-venv python3-pip git

# Fedora / RHEL
sudo dnf install -y python3.11 python3-pip git

# Arch
sudo pacman -S python git
```

**2. Clone the repository**

```bash
git clone https://github.com/your-username/code-review-agent.git
cd code-review-agent
```

**3. Create and activate a virtual environment**

```bash
python3.11 -m venv .venv
source .venv/bin/activate
```

**4. Install the package**

```bash
pip install -e ".[dev]"
```

**5. Verify**

```bash
reviewagent --help
```

</details>

<br/>

<div align="center">
<img src="./quickstart-flow.svg" alt="Quickstart pipeline — install, configure, run, report" width="100%"/></div>

<br/>

## 🖥️ Run the Web App Locally

This project runs as a regular Vite/Express application and does **not** require AI Studio.

<table>
<tr><th>Windows (PowerShell)</th><th>macOS / Linux</th></tr>
<tr>
<td>

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

</td>
<td>

```bash
npm install
cp .env.example .env
npm run dev
```

</td>
</tr>
</table>

Open **http://localhost:3000** in your browser.

> Put your real `GEMINI_API_KEY` or `OPENROUTER_API_KEY` only in `.env` — `.env` is git-ignored.
> To publish the source on GitHub, commit `.env.example`, **never** `.env`.

## Deploy to Vercel

Import this GitHub repository into Vercel. Vercel uses `npm run build`, publishes
the Vite output from `dist`, and serves the Express API through the Vercel
function in `api/[...path].ts`.

Add these environment variables in Vercel Project Settings → Environment Variables:

```text
GEMINI_API_KEY=your-gemini-api-key
OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=nvidia/nemotron-3.5-lightning:free
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
APP_URL=https://your-project.vercel.app
VITE_FIREBASE_API_KEY=your-firebase-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-firebase-app-id
VITE_FIREBASE_MEASUREMENT_ID=
```

Enable the variables for Production and Preview, then redeploy. In Firebase
Console → Authentication → Settings → Authorized domains, add your Vercel
hostname, such as `llm-code-review-agent.vercel.app`, and any custom domain.
Keep `localhost` there for local development. In Authentication → Sign-in
method, enable Google.

## Firebase development

The browser stores only project metadata in Firestore and uploads source content
to Cloud Storage under the authenticated user's project path. Enable Authentication
(Google and GitHub), Firestore, Storage, and App Check in the Firebase project.

For local emulators, install the Firebase CLI and run:

```bash
firebase login
firebase use llm-code-review-agent
npm run emulators
```

Set `VITE_USE_FIREBASE_EMULATORS=true` in `.env` when running the Vite app locally.
The required callback for Firebase GitHub authentication is:

```text
https://llm-code-review-agent.firebaseapp.com/__/auth/handler
```

The current Express API remains in place because it already owns the Gemini,
OpenRouter, GitHub public-import, and Vercel function routes. Firebase Storage and
Firestore persistence are best-effort and do not replace the existing AI provider
server boundary.

<br/>

## 🔑 Configuration

<details open>
<summary><b>Option A — OpenRouter Free NVIDIA Nemotron 70B</b> <sub>(recommended)</sub></summary>

<br/>

```bash
# 1. Get a free API key at https://openrouter.ai/keys
export OPENROUTER_API_KEY="sk-or-v1-..."      # macOS / Linux
$env:OPENROUTER_API_KEY = "sk-or-v1-..."      # Windows PowerShell

# Default model is nvidia/llama-3.1-nemotron-70b-instruct:free
```

</details>

<details>
<summary><b>Option B — Anthropic Claude</b></summary>

<br/>

```bash
export ANTHROPIC_API_KEY="sk-ant-api03-..."   # macOS / Linux
$env:ANTHROPIC_API_KEY = "sk-ant-api03-..."   # Windows PowerShell
```

</details>

<br/>

## 🚀 Usage

### 1️⃣ Run a full repository review

```bash
# Default uses nvidia/llama-3.1-nemotron-70b-instruct:free via OpenRouter
reviewagent review https://github.com/pallets/click.git
```

**Custom options:**

```bash
reviewagent review https://github.com/encode/httpx.git \
  --output ./httpx_report.md \
  --model nvidia/llama-3.1-nemotron-70b-instruct:free \
  --max-tokens 3000 \
  --overlap-tokens 300 \
  --keep-clone
```

<details>
<summary><b>📋 Full flag reference</b></summary>

<br/>

| Flag | Description | Default |
|---|---|---|
| `--output, -o` | Path to the generated Markdown report | `code_review_report.md` |
| `--model, -m` | LLM model identifier | `nvidia/llama-3.1-nemotron-70b-instruct:free` / `claude-3-5-sonnet-20241022` |
| `--provider, -p` | Provider override — `openrouter` or `anthropic` | auto-detected |
| `--max-tokens` | Approximate token budget per chunk before splitting | `3000` |
| `--overlap-tokens` | Overlap budget between adjacent chunks | `300` |
| `--keep-clone` | Retains the cloned repository on disk for inspection | off |
| `--session-dir` | Directory storing serialized conversation sessions | `.reviewagent_sessions` |

</details>

### 2️⃣ Ask follow-up questions for a specific file

```bash
reviewagent followup "src/httpx/_client.py" \
  "Why is the connection pool cleanup flagged as a leak on line 180?"
```

<br/>

## 🧪 Testing

```bash
pytest -v
```

### Property-Based Invariant Testing

The chunking engine (`src/reviewagent/chunker.py`) is verified with **Hypothesis** in `tests/test_chunker.py` across hundreds of randomized text streams, guaranteeing three core invariants:

```mermaid
flowchart LR
    A["📏 Line Integrity<br/><sub>chunks split strictly on line boundaries</sub>"] --> D(["✅ Verified<br/>hundreds of random inputs"])
    B["🔢 Order Preservation<br/><sub>strict ascending line numbers, no gaps</sub>"] --> D
    C["🔁 Lossless Reconstruction<br/><sub>trimmed overlaps reproduce original byte-for-byte</sub>"] --> D

    classDef inv fill:#161b22,stroke:#58A6FF,stroke-width:1.5px,color:#c9d1d9,rx:8,ry:8
    classDef pass fill:#0F2027,stroke:#2ea44f,stroke-width:2px,color:#ffffff,rx:20,ry:20
    class A,B,C inv
    class D pass
```

<br/>

## 📁 Project Structure

```
code-review-agent/
├── pyproject.toml              # Hatchling build & dependencies (openai, anthropic, typer)
├── README.md                   # Full architecture & CLI manual
├── .env.example                # Environment variables template
├── assets/                     # README banners & diagrams
│   ├── hero-banner.svg
│   ├── terminal-demo.svg
│   ├── platforms-banner.svg
│   └── quickstart-flow.svg
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

<br/>

## 🗺️ Roadmap

- [ ] Multi-language support beyond Python
- [ ] JSON / SARIF export for CI integration
- [ ] GitHub Action for automated PR reviews
- [ ] Parallel chunk review with rate-limit backoff
- [ ] Web dashboard for report browsing

<br/>

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check the [issues page](../../issues) or open a pull request.

```bash
# Fork → clone → branch → commit → push → PR
git checkout -b feat/your-feature-name
```

<br/>

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

---

<div align="center">

<img
  src="./professional-footer.png"
  alt="Code Review Agent — Review Deeper, Ship Safer"
  width="100%"
/>

<br/><br/>

[![Get Started](https://img.shields.io/badge/GET%20STARTED-Installation-58A6FF?style=for-the-badge&logo=rocket&logoColor=white)](#-installation--setup-guide)
[![View Usage](https://img.shields.io/badge/EXPLORE-CLI%20Usage-6C4EFF?style=for-the-badge&logo=gnubash&logoColor=white)](#-usage)
[![Run Tests](https://img.shields.io/badge/VERIFY-Test%20Suite-2EA44F?style=for-the-badge&logo=pytest&logoColor=white)](#-testing)
[![Contribute](https://img.shields.io/badge/CONTRIBUTE-Pull%20Request-D97757?style=for-the-badge&logo=github&logoColor=white)](#-contributing)

<br/><br/>

<sub>Structured AI review · Line-safe context · Deduplicated findings · Grounded conversations</sub>

</div>
