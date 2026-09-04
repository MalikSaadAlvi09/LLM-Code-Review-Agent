from difflib import SequenceMatcher
from typing import List
from reviewagent.review import Finding


def are_findings_similar(f1: Finding, f2: Finding, line_tolerance: int = 2, text_similarity_threshold: float = 0.6) -> bool:
    """
    Checks if two findings refer to the same underlying issue.
    Uses line proximity and fuzzy text similarity.
    """
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
    """
    Deduplicates a list of findings from adjacent overlapping chunks.
    Preserves the more detailed description when duplicates are merged.
    """
    if not findings:
        return []

    # Sort by line number, then severity
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
                # Keep whichever finding has longer/more detailed description
                if len(finding.description) > len(existing.description):
                    merged[i] = finding
                break

        if not is_dup:
            merged.append(finding)

    return merged


def aggregate_chunk_findings(chunk_finding_lists: List[List[Finding]]) -> List[Finding]:
    """
    Combines all findings across multiple chunks of a single file and deduplicates.
    """
    all_findings = [f for sublist in chunk_finding_lists for f in sublist]
    return deduplicate_findings(all_findings)
