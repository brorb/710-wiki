#!/usr/bin/env python3
"""Utility script to inventory date-like strings across the Markdown corpus.

Outputs CSV and JSON summaries under ./output/ for downstream review.
"""
from __future__ import annotations

import csv
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterator, List, Optional, Sequence, Tuple

# Repository layout ---------------------------------------------------------
THIS_FILE = Path(__file__).resolve()
PROJECT_ROOT = THIS_FILE.parent.parent
CONTENT_DIR = PROJECT_ROOT / "Content"
OUTPUT_DIR = THIS_FILE.parent / "output"

# Regex building blocks -----------------------------------------------------
MONTH_PATTERN = (
    r"Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|"
    r"Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?"
)
SEASON_PATTERN = r"Spring|Summer|Autumn|Fall|Winter"
ORDINAL_SUFFIX = r"(?:st|nd|rd|th)"
YEAR_PATTERN = r"'?\d{2,4}"

COMMON_FLAGS = re.IGNORECASE

@dataclass(frozen=True)
class PatternSpec:
    name: str
    regex: re.Pattern[str]
    validator: Optional[Callable[[re.Match[str]], bool]] = None


def _compile_patterns() -> Sequence[PatternSpec]:
    patterns: List[PatternSpec] = []

    patterns.append(
        PatternSpec(
            "day_month_year",
            re.compile(
                rf"\b(?P<day>\d{{1,2}}){ORDINAL_SUFFIX}?"  # day with optional ordinal
                rf"(?:\s+of)?\s+(?P<month>{MONTH_PATTERN})\.?"  # month word
                rf"(?:\s+(?:of|in))?"  # optional connector before year
                rf"(?:,|\s)+(?P<year>{YEAR_PATTERN})\b",
                COMMON_FLAGS,
            ),
        )
    )

    patterns.append(
        PatternSpec(
            "month_day_year",
            re.compile(
                rf"\b(?P<month>{MONTH_PATTERN})\.?\s+"
                rf"(?P<day>\d{{1,2}}){ORDINAL_SUFFIX}?"
                rf"(?:\s+(?:of|in))?"  # optional connector before year
                rf"(?:,|\s)+(?P<year>{YEAR_PATTERN})\b",
                COMMON_FLAGS,
            ),
        )
    )

    patterns.append(
        PatternSpec(
            "year_month_day",
            re.compile(
                r"\b(?P<year>\d{4})\s*[-/.]\s*(?P<month>\d{1,2})\s*[-/.]\s*(?P<day>\d{1,2})\b",
                COMMON_FLAGS,
            ),
        )
    )

    patterns.append(
        PatternSpec(
            "day_month",
            re.compile(
                rf"\b(?P<day>\d{{1,2}}){ORDINAL_SUFFIX}?"  # day only
                rf"(?:\s+of)?\s+(?P<month>{MONTH_PATTERN})\b",
                COMMON_FLAGS,
            ),
        )
    )

    patterns.append(
        PatternSpec(
            "month_year",
            re.compile(
                rf"\b(?P<month>{MONTH_PATTERN})\.?"
                rf"(?:\s+(?:of|in))?\s+(?P<year>{YEAR_PATTERN})\b",
                COMMON_FLAGS,
            ),
        )
    )

    patterns.append(
        PatternSpec(
            "numeric_day_month_year",
            re.compile(
                r"\b(?P<part1>\d{1,2})\s*[-/.]\s*(?P<part2>\d{1,2})\s*[-/.]\s*(?P<part3>'?\d{2,4})\b",
                COMMON_FLAGS,
            ),
        )
    )

    patterns.append(
        PatternSpec(
            "numeric_month_year",
            re.compile(
                r"\b(?P<month>\d{1,2})\s*[-/.]\s*(?P<year>'?\d{2,4})\b",
                COMMON_FLAGS,
            ),
            validator=_numeric_month_year_is_valid,
        )
    )

    patterns.append(
        PatternSpec(
            "season_year",
            re.compile(
                rf"\b(?P<season>{SEASON_PATTERN})\s+(?P<year>{YEAR_PATTERN})\b",
                COMMON_FLAGS,
            ),
        )
    )

    return patterns


def _numeric_month_year_is_valid(match: re.Match[str]) -> bool:
    """Reject obvious non-year usages like channel name "7/10"."""
    year_text = match.group("year")
    digits = re.sub(r"\D", "", year_text)
    if len(digits) == 4:
        return True
    if year_text.startswith("'") and len(digits) == 2:
        return True
    # Treat bare two-digit values as non-years to avoid 7/10 Tone hits.
    return False


PATTERNS = _compile_patterns()

# Data containers -----------------------------------------------------------
@dataclass(frozen=True)
class MatchRecord:
    file_path: Path
    relative_path: Path
    line_number: int
    pattern_name: str
    match_text: str
    line_content: str


# Markdown helpers ----------------------------------------------------------
def iter_relevant_lines(text: str) -> Iterator[Tuple[int, str]]:
    """Yield (line_number, line_text) for lines outside front matter & fences."""
    in_front_matter = False
    front_matter_handled = False
    in_code_fence = False
    fence_token: Optional[str] = None
    in_callout = False

    lines = text.splitlines()
    for index, raw_line in enumerate(lines, start=1):
        stripped = raw_line.strip()

        if not front_matter_handled and index == 1 and stripped == "---":
            in_front_matter = True
            front_matter_handled = True
            continue

        if in_front_matter:
            if stripped == "---":
                in_front_matter = False
            continue

        if stripped.startswith(">"):
            if stripped.startswith("> [!"):
                in_callout = True
                continue
            if in_callout:
                continue
        else:
            in_callout = False

        if stripped.startswith("```") or stripped.startswith("~~~"):
            token = stripped[:3]
            if not in_code_fence:
                in_code_fence = True
                fence_token = token
                continue
            if in_code_fence and token == fence_token:
                in_code_fence = False
                fence_token = None
            continue

        if in_code_fence:
            continue

        yield index, raw_line


def find_date_matches(line: str) -> List[Tuple[Tuple[int, int], PatternSpec, re.Match[str]]]:
    """Return unique pattern matches for the line, preferring wider spans."""
    candidates: List[Tuple[Tuple[int, int], PatternSpec, re.Match[str]]] = []

    for pattern in PATTERNS:
        for match in pattern.regex.finditer(line):
            if pattern.validator and not pattern.validator(match):
                continue
            candidates.append((match.span(), pattern, match))

    # Prefer longer spans first so nested shorter matches are discarded.
    candidates.sort(key=lambda item: (-(item[0][1] - item[0][0]), item[0][0]))

    accepted: List[Tuple[Tuple[int, int], PatternSpec, re.Match[str]]] = []
    covered_spans: List[Tuple[int, int]] = []

    for span, pattern, match in candidates:
        if any(span[0] >= existing[0] and span[1] <= existing[1] for existing in covered_spans):
            continue
        accepted.append((span, pattern, match))
        covered_spans.append(span)

    accepted.sort(key=lambda item: item[0])
    return accepted


def scan_file(path: Path) -> List[MatchRecord]:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        # Fallback: try latin-1 to avoid crashes (logged later in summary).
        text = path.read_text(encoding="latin-1")

    records: List[MatchRecord] = []
    for line_number, line in iter_relevant_lines(text):
        for _, pattern, match in find_date_matches(line):
            records.append(
                MatchRecord(
                    file_path=path,
                    relative_path=path.relative_to(PROJECT_ROOT),
                    line_number=line_number,
                    pattern_name=pattern.name,
                    match_text=match.group(0),
                    line_content=line.rstrip("\n"),
                )
            )
    return records


def ensure_output_dir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def write_csv(records: Sequence[MatchRecord], path: Path) -> None:
    with path.open("w", encoding="utf-8", newline="") as fp:
        writer = csv.writer(fp)
        writer.writerow([
            "file",
            "line_number",
            "pattern",
            "match_text",
            "line_content",
        ])
        for record in records:
            writer.writerow([
                str(record.relative_path).replace("\\", "/"),
                record.line_number,
                record.pattern_name,
                record.match_text,
                record.line_content,
            ])


def write_summary(records: Sequence[MatchRecord], path: Path) -> None:
    summary = {
        "total_matches": len(records),
        "files_with_matches": len({rec.relative_path for rec in records}),
        "pattern_counts": Counter(rec.pattern_name for rec in records),
    }
    summary["pattern_counts"] = dict(summary["pattern_counts"])  # JSON serialisable
    with path.open("w", encoding="utf-8") as fp:
        json.dump(summary, fp, indent=2, sort_keys=True)


def gather_markdown_files() -> List[Path]:
    if not CONTENT_DIR.exists():
        raise SystemExit(f"Content directory not found: {CONTENT_DIR}")
    return sorted(CONTENT_DIR.rglob("*.md"))


def main(argv: Sequence[str]) -> int:
    ensure_output_dir()
    files = gather_markdown_files()
    all_records: List[MatchRecord] = []

    for md_file in files:
        all_records.extend(scan_file(md_file))

    csv_path = OUTPUT_DIR / "detected_dates.csv"
    summary_path = OUTPUT_DIR / "detected_dates_summary.json"
    write_csv(all_records, csv_path)
    write_summary(all_records, summary_path)

    print(f"Analyzed {len(files)} markdown files.")
    print(f"Found {len(all_records)} candidate matches across {len({rec.relative_path for rec in all_records})} files.")
    print(f"CSV output: {csv_path.relative_to(PROJECT_ROOT)}")
    print(f"Summary: {summary_path.relative_to(PROJECT_ROOT)}")
    if all_records:
        top_patterns = Counter(rec.pattern_name for rec in all_records).most_common(8)
        print("Top patterns:")
        for name, count in top_patterns:
            print(f"  {name:>22} : {count}")
    else:
        print("No date-like strings detected.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
