#!/usr/bin/env python3
"""Apply manual date corrections captured in output/rejected_dates.csv.

Rows marked with a manual replacement string will be merged back into the
source Markdown files, provided the target line still matches the
original text recorded during the interactive review. Successfully
applied rows are marked as "applied" to avoid duplicate processing.
"""
from __future__ import annotations

import csv
import sys
from collections import defaultdict
from pathlib import Path
from typing import Dict, List

from analyze_dates import PROJECT_ROOT  # type: ignore

THIS_FILE = Path(__file__).resolve()
REJECTS_PATH = THIS_FILE.parent / "output" / "rejected_dates.csv"


def load_reject_rows() -> tuple[List[Dict[str, str]], List[str]]:
    if not REJECTS_PATH.exists():
        raise SystemExit(f"Reject log not found: {REJECTS_PATH}")
    with REJECTS_PATH.open("r", encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        rows = list(reader)
        fieldnames = list(reader.fieldnames or [])
        return rows, fieldnames


def group_rows_by_file(rows: List[Dict[str, str]]) -> Dict[Path, List[Dict[str, str]]]:
    grouped: Dict[Path, List[Dict[str, str]]] = defaultdict(list)
    for row in rows:
        manual = (row.get("manual_replacement") or "").strip()
        status = (row.get("status") or "").strip().lower()
        if not manual or status == "applied":
            continue
        file_rel = row.get("file")
        if not file_rel:
            row["status"] = "error: missing file path"
            continue
        file_path = (PROJECT_ROOT / file_rel).resolve()
        grouped[file_path].append(row)
    return grouped


def apply_rows_to_file(file_path: Path, rows: List[Dict[str, str]]) -> None:
    if not file_path.exists():
        for row in rows:
            row["status"] = "error: file not found"
        return

    text = file_path.read_text(encoding="utf-8")
    lines = text.splitlines()
    had_trailing_newline = text.endswith("\n") or text.endswith("\r\n")
    changed = False

    rows.sort(key=lambda r: int(r.get("line_number", "0")))

    for row in rows:
        try:
            line_index = int(row.get("line_number", "0")) - 1
        except ValueError:
            row["status"] = "error: invalid line number"
            continue

        if line_index < 0 or line_index >= len(lines):
            row["status"] = "error: line out of range"
            continue

        expected_line = row.get("original_line", "")
        if lines[line_index] != expected_line:
            row["status"] = "error: line content mismatch"
            continue

        replacement = row.get("manual_replacement", "")
        lines[line_index] = replacement
        row["status"] = "applied"
        changed = True

    if changed:
        new_text = "\n".join(lines)
        if had_trailing_newline and lines:
            new_text += "\n"
        file_path.write_text(new_text, encoding="utf-8")


def write_rows(rows: List[Dict[str, str]], fieldnames: List[str]) -> None:
    if "status" not in fieldnames:
        fieldnames.append("status")
    with REJECTS_PATH.open("w", encoding="utf-8", newline="") as fp:
        writer = csv.DictWriter(fp, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)


def main() -> None:
    rows, fieldnames = load_reject_rows()
    grouped = group_rows_by_file(rows)
    if not grouped:
        print("No manual replacements to apply.")
        return

    for file_path, grouped_rows in grouped.items():
        apply_rows_to_file(file_path, grouped_rows)

    applied = sum(1 for row in rows if row.get("status") == "applied")
    write_rows(rows, fieldnames)
    if applied:
        print(f"Applied {applied} manual correction(s).")
    else:
        print("No corrections applied (check status column for details).")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted by user.")
        sys.exit(1)
