from reviewagent.aggregate import deduplicate_findings, aggregate_chunk_findings
from reviewagent.review import Finding


def test_deduplicate_identical_and_near_duplicates():
    findings = [
        Finding(
            line=42,
            severity="bug",
            title="Unclosed database connection",
            description="Connection object 'conn' is opened without context manager.",
            suggestion="Use with sqlite3.connect(...) as conn:",
        ),
        # Slightly shifted line number and different phrasing from adjacent chunk
        Finding(
            line=43,
            severity="bug",
            title="Unclosed database connection",
            description="The database connection is never closed, leading to a socket leak.",
            suggestion="Wrap in a context manager",
        ),
        # Separate finding on different line
        Finding(
            line=90,
            severity="style",
            title="Comparison to True",
            description="Use 'if active:' instead of 'if active == True:'",
            suggestion="if active:",
        ),
    ]

    deduped = deduplicate_findings(findings)
    assert len(deduped) == 2

    # Should retain one bug finding and one style finding
    severities = [f.severity for f in deduped]
    assert "bug" in severities
    assert "style" in severities


def test_aggregate_multiple_chunk_lists():
    chunk1_findings = [
        Finding(line=10, severity="logic", title="Off by one", description="Range upper bound is exclusive"),
    ]
    chunk2_findings = [
        Finding(line=11, severity="logic", title="Off by one", description="Range upper bound is exclusive, missing last item"),
        Finding(line=50, severity="style", title="Wildcard import", description="Avoid import *"),
    ]

    merged = aggregate_chunk_findings([chunk1_findings, chunk2_findings])
    assert len(merged) == 2
    assert merged[0].line in (10, 11)
    assert merged[1].line == 50
