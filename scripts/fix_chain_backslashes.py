#!/usr/bin/env python3
from __future__ import annotations

import pathlib

import re

path = pathlib.Path("Content/Discord/System Chats.md")
text = path.read_text(encoding="utf-8")

def normalize(match: re.Match[str]) -> str:
	return r"\\chain"

text = re.sub(r"\\+chain", normalize, text)
path.write_text(text, encoding="utf-8")
