import json
import re
import time
from typing import Any, List, Literal, Optional, Union
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

If no issues are found, return {"summary": "Code is clean and well-structured.", "findings": []}.
Do NOT output markdown fences around the JSON, and do NOT include conversational filler before or after the JSON.
"""


def format_code_with_line_numbers(lines: List[str], start_line: int = 1) -> str:
    formatted = []
    for idx, line in enumerate(lines):
        line_num = start_line + idx
        # Keep newline intact
        line_clean = line.rstrip("\r\n")
        formatted.append(f"{line_num:4d} | {line_clean}")
    return "\n".join(formatted)


def extract_json_payload(text: str) -> dict:
    text = text.strip()
    # Strip markdown code fences if LLM included them
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try finding the first '{' and last '}'
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            return json.loads(text[start : end + 1])
        raise


def call_llm(client: Any, model: str, system_prompt: str, user_prompt: str) -> str:
    """Executes a chat completion across OpenRouter (OpenAI-compatible) or Anthropic Claude."""
    # Check if client is OpenAI-compatible (OpenRouter for Nemotron / custom models)
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
    
    # Anthropic client
    if hasattr(client, "messages") and hasattr(client.messages, "create"):
        response = client.messages.create(
            model=model,
            max_tokens=4000,
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_prompt}
            ],
        )
        text = ""
        for block in response.content:
            if hasattr(block, "text"):
                text += block.text
        return text

    raise TypeError(f"Unsupported LLM client type: {type(client)}")


def review_chunk(
    client: Any,
    model: str,
    file_path: str,
    chunk: Chunk,
    max_retries: int = 3,
) -> List[Finding]:
    formatted_code = format_code_with_line_numbers(chunk.lines, start_line=chunk.start_line)
    
    prompt = f"File: {file_path}\nLine Range: {chunk.start_line} to {chunk.end_line}\n\n```python\n{formatted_code}\n```"

    backoff = 2.0
    for attempt in range(max_retries):
        try:
            response_text = call_llm(
                client=client,
                model=model,
                system_prompt=REVIEW_SYSTEM_PROMPT,
                user_prompt=prompt,
            )

            data = extract_json_payload(response_text)
            raw_findings = data.get("findings", [])
            
            findings: List[Finding] = []
            for item in raw_findings:
                # Clamp line number within chunk boundaries if hallucinated
                line_val = int(item.get("line", chunk.start_line))
                if line_val < chunk.start_line or line_val > chunk.end_line:
                    line_val = max(chunk.start_line, min(chunk.end_line, line_val))
                
                sev = item.get("severity", "style").lower()
                if sev not in ("bug", "logic", "style"):
                    sev = "style"

                findings.append(
                    Finding(
                        line=line_val,
                        severity=sev,
                        title=str(item.get("title", "Review Finding")),
                        description=str(item.get("description", "")),
                        suggestion=item.get("suggestion"),
                    )
                )

            return findings

        except Exception as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(backoff)
            backoff *= 2.0

    return []

