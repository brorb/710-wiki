#!/usr/bin/env python3
from __future__ import annotations

import pathlib
import re

FILES = [
    pathlib.Path("Content/Discord/System Chats.md"),
    pathlib.Path("Content/Characters/SYSTEM.md"),
]

pattern = re.compile(r'""([^"\\]+?)""')

for path in FILES:
    text = path.read_text(encoding="utf-8")
    new_text = pattern.sub(r'\"\1\"', text)
    if new_text != text:
        path.write_text(new_text, encoding="utf-8")
