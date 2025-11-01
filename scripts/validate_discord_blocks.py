#!/usr/bin/env python3
"""Validate Discord transcript code fences for well-formed JSON."""
from __future__ import annotations

import json
import pathlib
import re
import sys

PATTERN = re.compile(r"```discord\s*\n(.*?)```", re.DOTALL)
FILES = (
    pathlib.Path("Content/Discord/System Chats.md"),
    pathlib.Path("Content/Characters/SYSTEM.md"),
)


def validate_file(path: pathlib.Path) -> int:
    text = path.read_text(encoding="utf-8")
    errors = 0
    for match in PATTERN.finditer(text):
        block = match.group(1)
        line_no = text.count("\n", 0, match.start()) + 1
        try:
            json.loads(block)
        except json.JSONDecodeError as exc:
            errors += 1
            context = block[exc.pos - 40 : exc.pos + 40]
            print(f"{path}:{line_no}: {exc.msg} (line {exc.lineno} col {exc.colno})", file=sys.stderr)
            print(f"    Context: {context!r}", file=sys.stderr)
    return errors


def main() -> int:
    total_errors = sum(validate_file(path) for path in FILES if path.exists())
    if total_errors:
        print(f"Found {total_errors} invalid blocks.", file=sys.stderr)
    else:
        print("All Discord code fences contain valid JSON.")
    return 1 if total_errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
