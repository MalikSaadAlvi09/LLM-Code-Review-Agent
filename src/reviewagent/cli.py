import os
import sys
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

app = typer.Typer(
    name="reviewagent",
    help="Autonomous CLI agent for Python code reviews using OpenRouter (NVIDIA Nemotron Free) or Anthropic Claude.",
    no_args_is_help=True,
)
console = Console()


def create_llm_client(
    settings: Settings,
    model: Optional[str] = None,
    provider: Optional[str] = None,
) -> Tuple[Any, str, str]:
    """Creates and returns the appropriate LLM client, resolved model string, and provider name."""
    resolved_model = model or settings.model
    resolved_provider = provider or settings.resolve_provider(resolved_model)

    if resolved_provider == "openrouter":
        api_key = settings.openrouter_api_key
        if not api_key:
            # Check if anthropic key exists as fallback
            if settings.anthropic_api_key and not provider:
                import anthropic
                return anthropic.Anthropic(api_key=settings.anthropic_api_key), "claude-3-5-sonnet-20241022", "Anthropic"
            
            console.print("[bold red]Error:[/bold red] OPENROUTER_API_KEY is not set.")
            console.print("To use the OpenRouter Free Nemotron model (e.g. nvidia/llama-3.1-nemotron-70b-instruct:free):")
            console.print("  1. Get an API key from https://openrouter.ai/keys")
            console.print("  2. Run: [bold green]export OPENROUTER_API_KEY=\"sk-or-v1-...\"[/bold green]")
            raise typer.Exit(code=1)

        try:
            from openai import OpenAI
            client = OpenAI(
                base_url=settings.openrouter_base_url,
                api_key=api_key,
                default_headers={
                    "HTTP-Referer": "https://github.com/code-review-agent",
                    "X-Title": "Code Review Agent (Nemotron Free)",
                },
            )
            return client, resolved_model, "OpenRouter"
        except ImportError:
            console.print("[bold red]Error:[/bold red] openai package not found. Run `pip install openai`.")
            raise typer.Exit(code=1)

    elif resolved_provider == "anthropic":
        api_key = settings.anthropic_api_key
        if not api_key:
            console.print("[bold red]Error:[/bold red] ANTHROPIC_API_KEY is not set.")
            console.print("Run: [bold green]export ANTHROPIC_API_KEY=\"sk-ant-...\"[/bold green]")
            raise typer.Exit(code=1)

        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        return client, resolved_model, "Anthropic"

    else:
        console.print(f"[bold red]Error:[/bold red] Unknown provider '{resolved_provider}'. Choose 'openrouter' or 'anthropic'.")
        raise typer.Exit(code=1)


@app.command(name="review")
def review(
    repo_url: str = typer.Argument(..., help="GitHub or git repository URL to clone and review"),
    output: Path = typer.Option(Path("code_review_report.md"), "--output", "-o", help="Path to write Markdown report"),
    max_tokens: int = typer.Option(3000, "--max-tokens", help="Maximum approximate tokens per chunk"),
    overlap_tokens: int = typer.Option(300, "--overlap-tokens", help="Token overlap between adjacent chunks"),
    model: Optional[str] = typer.Option(
        None, 
        "--model", 
        "-m", 
        help="LLM model name (default: nvidia/llama-3.1-nemotron-70b-instruct:free on OpenRouter or claude-3-5-sonnet-20241022)"
    ),
    provider: Optional[str] = typer.Option(
        None,
        "--provider",
        "-p",
        help="LLM provider: 'openrouter' or 'anthropic' (auto-detected by default)",
    ),
    keep_clone: bool = typer.Option(False, "--keep-clone", help="Preserve cloned repository after review"),
    session_dir: Path = typer.Option(Path(".reviewagent_sessions"), "--session-dir", help="Directory to save conversation histories"),
):
    """
    Clones a repository, walks Python files, chunks large files, calls OpenRouter Nemotron / Claude for review,
    aggregates findings, saves conversation sessions for follow-ups, and writes a Markdown report.
    """
    settings = Settings()
    client, selected_model, provider_name = create_llm_client(settings, model=model, provider=provider)

    console.print(f"[bold blue]Code Review Agent[/bold blue] starting review for [cyan]{repo_url}[/cyan]")
    console.print(f"Provider: [bold magenta]{provider_name}[/bold magenta] | Model: [bold yellow]{selected_model}[/bold yellow]")

    try:
        with temporary_clone(repo_url, keep=keep_clone) as clone_path:
            console.print(f"Repository cloned to [dim]{clone_path}[/dim]")

            python_files = discover_python_files(clone_path)
            if not python_files:
                console.print("[yellow]No Python files found to review in the repository.[/yellow]")
                raise typer.Exit(code=0)

            console.print(f"Discovered [bold green]{len(python_files)}[/bold green] Python files.")
            session_dir.mkdir(parents=True, exist_ok=True)

            results: list[FileReviewResult] = []

            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TaskProgressColumn(),
                console=console,
            ) as progress:
                review_task = progress.add_task("Reviewing files...", total=len(python_files))

                for file_path in python_files:
                    rel_path = str(file_path.relative_to(clone_path)).replace("\\", "/")
                    progress.update(review_task, description=f"Reviewing {rel_path}")

                    try:
                        content = file_path.read_text(encoding="utf-8", errors="replace")
                        lines = content.splitlines(keepends=True)
                    except OSError as e:
                        console.print(f"[red]Could not read {rel_path}: {e}[/red]")
                        progress.advance(review_task)
                        continue

                    chunks = chunk_lines(lines, max_tokens=max_tokens, overlap_tokens=overlap_tokens)
                    chunk_findings_list = []

                    for chunk in chunks:
                        try:
                            findings = review_chunk(
                                client=client,
                                model=selected_model,
                                file_path=rel_path,
                                chunk=chunk,
                            )
                            chunk_findings_list.append(findings)
                        except Exception as e:
                            console.print(f"[red]Review failed for chunk in {rel_path}: {e}[/red]")

                    final_findings = aggregate_chunk_findings(chunk_findings_list)
                    
                    # Store file result
                    res = FileReviewResult(
                        file_path=rel_path,
                        findings=final_findings,
                    )
                    results.append(res)

                    # Initialize and save conversation session for follow-ups
                    conv = Conversation(
                        file_path=rel_path,
                        file_content=content,
                    )
                    # Add initial system turn findings context
                    findings_summary = "\n".join(
                        [f"- Line {f.line} [{f.severity.upper()}]: {f.title} - {f.description}" for f in final_findings]
                    ) or "No findings were identified in the initial review pass."
                    conv.add_assistant_message(f"Initial Review Findings for {rel_path} using {selected_model}:\n{findings_summary}")
                    conv.save(str(session_dir))

                    progress.advance(review_task)

            # Generate and write report
            report_content = generate_markdown_report(
                repo_url=repo_url,
                results=results,
                model_name=selected_model,
            )
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(report_content, encoding="utf-8")

            total_findings = sum(len(r.findings) for r in results)
            console.print(f"\n[bold green]Success![/bold green] Review complete. Found {total_findings} total issues.")
            console.print(f"Report written to: [bold underline cyan]{output.resolve()}[/bold underline cyan]")
            console.print(f"Session histories saved in [dim]{session_dir.resolve()}[/dim]")
            console.print(f"\nTo ask follow-up questions, run:")
            console.print(f"  [bold]reviewagent followup <file_path> \"<question>\"[/bold]")

    except CloneError as e:
        console.print(f"[bold red]Clone Error:[/bold red] {e}")
        raise typer.Exit(code=1)
    except Exception as e:
        console.print(f"[bold red]Unexpected Error:[/bold red] {e}")
        raise typer.Exit(code=1)


@app.command(name="followup")
def followup(
    file_path: str = typer.Argument(..., help="Relative path of the reviewed file (e.g. app/auth.py)"),
    question: str = typer.Argument(..., help="Question to ask about the file or its findings"),
    session_dir: Path = typer.Option(Path(".reviewagent_sessions"), "--session-dir", help="Directory containing conversation sessions"),
    model: Optional[str] = typer.Option(None, "--model", "-m", help="Model name override"),
    provider: Optional[str] = typer.Option(None, "--provider", "-p", help="Provider override: 'openrouter' or 'anthropic'"),
):
    """
    Reopens a stored conversation session for a specific reviewed file and asks a follow-up question.
    """
    settings = Settings()
    client, selected_model, provider_name = create_llm_client(settings, model=model, provider=provider)

    try:
        conv = Conversation.load(file_path, session_dir=str(session_dir))
    except FileNotFoundError:
        console.print(f"[bold red]Error:[/bold red] No saved review session found for '{file_path}' in {session_dir}.")
        console.print("Run `reviewagent review <repo>` first to generate sessions.")
        raise typer.Exit(code=1)

    console.print(f"[bold cyan]File:[/bold cyan] {conv.file_path}")
    console.print(f"[bold magenta]Provider:[/bold magenta] {provider_name} ({selected_model})")
    console.print(f"[bold green]Question:[/bold green] {question}\n")

    with console.status("[bold yellow]Thinking with Nemotron/LLM...[/bold yellow]"):
        try:
            answer = conv.ask(client=client, model=selected_model, question=question)
            conv.save(str(session_dir))
        except Exception as e:
            console.print(f"[bold red]Error during follow-up query:[/bold red] {e}")
            raise typer.Exit(code=1)

    console.print(f"[bold]Response:[/bold]\n{answer}")


def main():
    app()


if __name__ == "__main__":
    main()

