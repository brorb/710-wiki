#!/usr/bin/env python3
from __future__ import annotations

import pathlib

TARGETS = [
    pathlib.Path("Content/Discord/System Chats.md"),
    pathlib.Path("Content/Characters/SYSTEM.md"),
]

PREFIX = '"content": "'

for path in TARGETS:
    text = path.read_text(encoding="utf-8")
    chars = []
    i = 0
    changed = False
    length = len(text)
    while i < length:
        if text.startswith(PREFIX, i):
            chars.append(PREFIX)
            i += len(PREFIX)
            value_chars: list[str] = []
            while i < length:
                ch = text[i]
                if ch == '\\':
                    if i + 1 < length:
                        value_chars.append(ch)
                        value_chars.append(text[i + 1])
                        i += 2
                        continue
                    value_chars.append(ch)
                    i += 1
                    break
                if ch == '"':
                    break
                value_chars.append(ch)
                i += 1
            # Escape bare quotes inside the value
            escaped: list[str] = []
            j = 0
            val_len = len(value_chars)
            while j < val_len:
                ch = value_chars[j]
                if ch == '"':
                    escaped.append('\\"')
                    changed = True
                    j += 1
                    continue
                if ch == '\\' and j + 1 < val_len:
                    escaped.append(ch)
                    escaped.append(value_chars[j + 1])
                    j += 2
                    continue
                escaped.append(ch)
                j += 1
            chars.extend(escaped)
            if i < length and text[i] == '"':
                chars.append('"')
                i += 1
            continue
        chars.append(text[i])
        i += 1
    if changed:
        path.write_text(''.join(chars), encoding="utf-8")
