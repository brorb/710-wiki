#!/usr/bin/env python3
"""Interactive tool to standardize dates across the Markdown corpus.

For each detected date, the script previews the existing line and the
proposed normalized variant with colored highlighting, then asks the
user to accept (y) or reject (n) the change. Rejected items are logged
for manual follow-up in output/rejected_dates.csv. Once manual edits
are completed, run apply_manual_corrections.py to merge them back into
the source files.
"""
from __future__ import annotations

import csv
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List

from colorama import Fore, Style, init as colorama_init

from analyze_dates import (  # type: ignore
    OUTPUT_DIR,
    PROJECT_ROOT,
    find_date_matches,
    gather_markdown_files,
    iter_relevant_lines,
)

colorama_init()

# ---------------------------------------------------------------------------
# Constants and helpers
# ---------------------------------------------------------------------------
THIS_FILE = Path(__file__).resolve()
DEFAULT_YEAR = 2025
REJECTS_PATH = OUTPUT_DIR / "rejected_dates.csv"

MONTH_ALIASES: Dict[str, int] = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}

MONTH_NAMES = {
    1: "January",
    2: "February",
    3: "March",
    4: "April",
    5: "May",
    6: "June",
    7: "July",
    8: "August",
    9: "September",
    10: "October",
    11: "November",
    12: "December",
}

SEASONS = {"spring", "summer", "autumn", "fall", "winter"}

BOLD = Style.BRIGHT
RESET = Style.RESET_ALL
RED = Fore.RED
GREEN = Fore.GREEN
CYAN = Fore.CYAN
DIM = Style.DIM


@dataclass
class Candidate:
    file_path: Path
    relative_path: Path
    line_index: int
    line_number: int
    pattern_name: str
    original_date: str
    normalized_date: str
    start: int
    end: int


@dataclass
class RejectRecord:
    file: str
    line_number: int
    pattern: str
    original_date: str
    suggested_date: str
    original_line: str
    manual_replacement: str
    note: str
    status: str = "pending"


# ---------------------------------------------------------------------------
# Normalization utilities
# ---------------------------------------------------------------------------

def _normalize_day(token: str) -> int:
    digits = "".join(ch for ch in token if ch.isdigit())
    if not digits:
        raise ValueError(f"Unable to parse day from '{token}'")
    day = int(digits)
    if not 1 <= day <= 31:
        raise ValueError(f"Invalid day value '{day}'")
    return day


def _normalize_month(token: str) -> int:
    cleaned = token.lower().strip().rstrip(".")
    if cleaned.isdigit():
        month = int(cleaned)
        if not 1 <= month <= 12:
            raise ValueError(f"Invalid month value '{month}'")
        return month
    month = MONTH_ALIASES.get(cleaned)
    if month is None:
        raise ValueError(f"Unknown month token '{token}'")
    return month


def _normalize_year(token: str) -> int:
    digits = "".join(ch for ch in token if ch.isdigit())
    if not digits:
        raise ValueError(f"Unable to parse year from '{token}'")
    if len(digits) == 2:
        value = int(digits)
        # Assume modern context unless it looks historical (>30 -> 1900s).
        return 2000 + value if value <= 30 else 1900 + value
    return int(digits)


def _format_date(day: int, month: int, year: int) -> str:
    return f"{day} {MONTH_NAMES[month]} {year}"


def normalize_match(pattern_name: str, groups: Dict[str, str]) -> str:
    if pattern_name == "day_month_year":
        day = _normalize_day(groups["day"])
        month = _normalize_month(groups["month"])
        year = _normalize_year(groups["year"])
        return _format_date(day, month, year)

    if pattern_name == "month_day_year":
        month = _normalize_month(groups["month"])
        day = _normalize_day(groups["day"])
        year = _normalize_year(groups["year"])
        return _format_date(day, month, year)

    if pattern_name == "day_month":
        day = _normalize_day(groups["day"])
        month = _normalize_month(groups["month"])
        return _format_date(day, month, DEFAULT_YEAR)

    if pattern_name == "month_year":
        month = _normalize_month(groups["month"])
        year = _normalize_year(groups["year"])
        return f"{MONTH_NAMES[month]} {year}"

    if pattern_name == "year_month_day":
        year = int(groups["year"])
        month = int(groups["month"])
        day = int(groups["day"])
        if not (1 <= month <= 12 and 1 <= day <= 31):
            raise ValueError("Invalid numeric date components")
        return _format_date(day, month, year)

    if pattern_name == "numeric_day_month_year":
        day = _normalize_day(groups["part1"])
        month = _normalize_day(groups["part2"])
        year = _normalize_year(groups["part3"])
        if not 1 <= month <= 12:
            raise ValueError("Numeric month outside 1-12 range")
        return _format_date(day, month, year)

    if pattern_name == "numeric_month_year":
        month = _normalize_month(groups["month"])
        year = _normalize_year(groups["year"])
        return f"{MONTH_NAMES[month]} {year}"

    if pattern_name == "season_year":
        season = groups["season"].strip().lower()
        year = _normalize_year(groups["year"])
        if season not in SEASONS:
            raise ValueError(f"Unknown season '{season}'")
        season_title = season.capitalize() if season != "fall" else "Fall"
        return f"{season_title} {year}"

    raise ValueError(f"Unhandled pattern '{pattern_name}'")


# ---------------------------------------------------------------------------
# Presentation helpers
# ---------------------------------------------------------------------------

def highlight_segment(text: str, start: int, end: int, color: str) -> str:
    return f"{text[:start]}{BOLD}{color}{text[start:end]}{RESET}{text[end:]}"


def ensure_output_directory() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def confirm_overwrite(path: Path) -> None:
    if path.exists() and path.read_text(encoding="utf-8").strip():
        print(f"{Fore.YELLOW}Warning:{RESET} existing reject log '{path.name}' will be overwritten.")
        while True:
            choice = input("Proceed? [y/n]: ").strip().lower()
            if choice in {"y", "n"}:
                break
        if choice != "y":
            print("Aborting at user request.")
            sys.exit(0)


# ---------------------------------------------------------------------------
# Candidate scanning
# ---------------------------------------------------------------------------

def build_candidates(file_path: Path) -> tuple[List[Candidate], List[RejectRecord]]:
    text = file_path.read_text(encoding="utf-8")
    candidates: List[Candidate] = []
    auto_rejects: List[RejectRecord] = []

    for line_number, line in iter_relevant_lines(text):
        line_index = line_number - 1
        for span, pattern, match in find_date_matches(line):
            original = match.group(0)
            try:
                normalized = normalize_match(pattern.name, match.groupdict())
            except ValueError as exc:
                auto_rejects.append(
                    RejectRecord(
                        file=str(file_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
                        line_number=line_number,
                        pattern=pattern.name,
                        original_date=original,
                        suggested_date="",
                        original_line=line.rstrip("\n"),
                        manual_replacement="",
                        note=str(exc),
                        status="pending",
                    )
                )
                continue

            if normalized == original:
                continue  # already compliant

            candidates.append(
                Candidate(
                    file_path=file_path,
                    relative_path=file_path.relative_to(PROJECT_ROOT),
                    line_index=line_index,
                    line_number=line_number,
                    pattern_name=pattern.name,
                    original_date=original,
                    normalized_date=normalized,
                    start=span[0],
                    end=span[1],
                )
            )

    return candidates, auto_rejects


# ---------------------------------------------------------------------------
# Interactive loop
# ---------------------------------------------------------------------------

def interactive_review() -> None:
    ensure_output_directory()
    confirm_overwrite(REJECTS_PATH)

    files = gather_markdown_files()
    total_candidates = 0
    applied_changes = 0
    rejected_changes: List[RejectRecord] = []
    auto_rejects_total = 0

    abort_requested = False

    for md_file in files:
        if abort_requested:
            break
        candidates, auto_rejects = build_candidates(md_file)
        if not candidates and not auto_rejects:
            continue
        auto_rejects_total += len(auto_rejects)
        rejected_changes.extend(auto_rejects)

        if not candidates:
            continue

        text = md_file.read_text(encoding="utf-8")
        lines = text.splitlines()
        had_trailing_newline = text.endswith("\n") or text.endswith("\r\n")

        index = 0
        modified = False
        while index < len(candidates):
            cand = candidates[index]
            total_candidates += 1
            line = lines[cand.line_index]
            before_line = highlight_segment(line, cand.start, cand.end, RED)
            after_line_plain = line[:cand.start] + cand.normalized_date + line[cand.end:]
            after_line = highlight_segment(after_line_plain, cand.start, cand.start + len(cand.normalized_date), GREEN)

            print()
            print(f"File: {cand.relative_path} (line {cand.line_number})")
            print(f"Pattern: {cand.pattern_name}")
            print("Before:")
            print(before_line)
            print("After:")
            print(after_line)

            while True:
                choice = input("Apply change? [y/n/q]: ").strip().lower()
                if choice in {"y", "n", "q"}:
                    break
                print("Please respond with 'y', 'n', or 'q'.")

            if choice == "q":
                print("Aborting at user request.")
                abort_requested = True
                break

            if choice == "y":
                lines[cand.line_index] = after_line_plain
                applied_changes += 1
                modified = True
                delta = len(cand.normalized_date) - (cand.end - cand.start)
                if delta != 0:
                    for future in candidates[index + 1 :]:
                        if future.line_index != cand.line_index:
                            break
                        future.start += delta
                        future.end += delta
                index += 1
                continue

            rejected_changes.append(
                RejectRecord(
                    file=str(cand.relative_path).replace("\\", "/"),
                    line_number=cand.line_number,
                    pattern=cand.pattern_name,
                    original_date=cand.original_date,
                    suggested_date=cand.normalized_date,
                    original_line=line,
                    manual_replacement="",
                    note="",
                    status="pending",
                )
            )
            index += 1

        if modified:
            new_text = "\n".join(lines)
            if had_trailing_newline and lines:
                new_text += "\n"
            md_file.write_text(new_text, encoding="utf-8")

    write_reject_log(rejected_changes)

    print("\n--- Summary ---")
    print(f"Reviewed candidates: {total_candidates}")
    print(f"Accepted changes:  {applied_changes}")
    print(f"Rejected (manual): {len(rejected_changes) - auto_rejects_total}")
    print(f"Rejected (auto):   {auto_rejects_total}")
    if rejected_changes:
        print(f"Pending manual edits logged to {REJECTS_PATH.relative_to(PROJECT_ROOT)}")


# ---------------------------------------------------------------------------
# Reject log handling
# ---------------------------------------------------------------------------

def write_reject_log(records: Iterable[RejectRecord]) -> None:
    records = list(records)
    with REJECTS_PATH.open("w", newline="", encoding="utf-8") as fp:
        fieldnames = [
            "file",
            "line_number",
            "pattern",
            "original_date",
            "suggested_date",
            "original_line",
            "manual_replacement",
            "note",
            "status",
        ]
        writer = csv.DictWriter(fp, fieldnames=fieldnames)
        writer.writeheader()
        for record in records:
            writer.writerow(
                {
                    "file": record.file,
                    "line_number": record.line_number,
                    "pattern": record.pattern,
                    "original_date": record.original_date,
                    "suggested_date": record.suggested_date,
                    "original_line": record.original_line,
                    "manual_replacement": record.manual_replacement,
                    "note": record.note,
                    "status": record.status,
                }
            )


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    try:
        interactive_review()
    except KeyboardInterrupt:
        print("\nInterrupted by user. No further changes applied.")
        sys.exit(1)
