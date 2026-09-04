from hypothesis import given, strategies as st, settings
import pytest

from reviewagent.chunker import chunk_lines, reconstruct_lines, Chunk


# Generate arbitrary Python-like lines
line_strategy = st.text(
    alphabet=st.characters(blacklist_categories=("Cs",)),
    min_size=0,
    max_size=120,
).map(lambda s: s.replace("\r", "").replace("\n", "") + "\n")

file_strategy = st.lists(line_strategy, min_size=1, max_size=200)


@given(
    lines=file_strategy,
    max_tokens=st.integers(min_value=20, max_value=500),
    overlap_tokens=st.integers(min_value=0, max_value=150),
)
@settings(max_examples=100)
def test_chunking_invariants(lines: list[str], max_tokens: int, overlap_tokens: int):
    # Ensure overlap is less than max
    safe_overlap = min(overlap_tokens, max(0, max_tokens // 4))

    chunks = chunk_lines(lines, max_tokens=max_tokens, overlap_tokens=safe_overlap)

    # Invariant 1: Non-empty file produces at least one chunk
    assert len(chunks) >= 1

    # Invariant 2: Chunks have valid and ascending line ranges
    prev_end = 0
    for chunk in chunks:
        assert 1 <= chunk.start_line <= chunk.end_line <= len(lines)
        assert len(chunk.lines) == (chunk.end_line - chunk.start_line + 1)
        # Content matches lines joined
        assert chunk.content == "".join(chunk.lines)
        # Line order inside each chunk matches original lines slice
        assert chunk.lines == lines[chunk.start_line - 1 : chunk.end_line]

    # Invariant 3: Chunks overlap or are adjacent (no gaps between chunks)
    for i in range(len(chunks) - 1):
        curr_chunk = chunks[i]
        next_chunk = chunks[i + 1]
        # Next chunk must start before or immediately at curr_chunk's end + 1
        assert next_chunk.start_line <= curr_chunk.end_line + 1
        # Next chunk must start after current chunk's start (strict forward progress)
        assert next_chunk.start_line > curr_chunk.start_line

    # Invariant 4: First chunk covers line 1, last chunk covers the final line
    assert chunks[0].start_line == 1
    assert chunks[-1].end_line == len(lines)

    # Invariant 5: Exact lossless reconstruction
    reconstructed = reconstruct_lines(chunks)
    assert reconstructed == lines


def test_empty_lines():
    assert chunk_lines([]) == []
    assert reconstruct_lines([]) == []


def test_single_small_file():
    lines = ["import os\n", "print('hello world')\n"]
    chunks = chunk_lines(lines, max_tokens=1000, overlap_tokens=100)
    assert len(chunks) == 1
    assert chunks[0].start_line == 1
    assert chunks[0].end_line == 2
    assert chunks[0].lines == lines
