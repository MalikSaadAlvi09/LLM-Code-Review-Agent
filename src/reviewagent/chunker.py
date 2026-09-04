from dataclasses import dataclass
from typing import List, Optional
import tiktoken

try:
    _ENCODER = tiktoken.get_encoding("cl100k_base")
except Exception:
    _ENCODER = None


def estimate_tokens(text: str) -> int:
    if _ENCODER:
        return len(_ENCODER.encode(text, disallowed_special=()))
    # Fallback heuristic: ~4 chars per token
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
    """
    Splits a list of lines into overlapping windows strictly on line boundaries.
    
    Invariants guaranteed:
    1. Every line is included in at least one chunk in its original order.
    2. Chunks are strictly contiguous line slices.
    3. If total file tokens <= max_tokens, returns a single chunk covering the whole file.
    """
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
    start_idx = 0  # 0-indexed pointer

    while start_idx < total_lines:
        current_tokens = 0
        end_idx = start_idx

        # Accumulate lines until max_tokens is reached
        while end_idx < total_lines:
            line_cost = line_token_counts[end_idx]
            if end_idx > start_idx and (current_tokens + line_cost > max_tokens):
                break
            current_tokens += line_cost
            end_idx += 1

        # Current chunk spans lines[start_idx:end_idx]
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

        # Calculate next start_idx by stepping back to maintain overlap_tokens
        backtrack_tokens = 0
        next_start = end_idx

        while next_start > start_idx + 1:
            prev_line_cost = line_token_counts[next_start - 1]
            if backtrack_tokens + prev_line_cost > overlap_tokens:
                break
            backtrack_tokens += prev_line_cost
            next_start -= 1

        # Ensure forward progress
        if next_start <= start_idx:
            start_idx = start_idx + 1
        else:
            start_idx = next_start

    return chunks


def reconstruct_lines(chunks: List[Chunk]) -> List[str]:
    """
    Reconstructs the original sequence of lines from overlapping chunks.
    Used for verification and testing.
    """
    if not chunks:
        return []
    
    result: List[str] = []
    next_expected_line = 1

    for chunk in chunks:
        # If chunk starts after next_expected_line (shouldn't happen with valid overlapping chunks)
        # or chunk starts before/at next_expected_line:
        offset = max(0, next_expected_line - chunk.start_line)
        if offset < len(chunk.lines):
            result.extend(chunk.lines[offset:])
            next_expected_line = chunk.end_line + 1

    return result
