#!/usr/bin/env python3
"""Synchronize Obsidian Webpage HTML Export canvases into the Quartz static folder."""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, Optional, Sequence, Tuple

import yaml

REPO_ROOT = Path(__file__).resolve().parent
CONTENT_ROOT = REPO_ROOT / "Content"
DEFAULT_EXPORT_ROOT = REPO_ROOT / "Canvas"
STATIC_CANVAS_ROOT = REPO_ROOT / "quartz-site" / "quartz" / "static" / "canvas"
STATIC_HTML_DIR = STATIC_CANVAS_ROOT / "html"
STATIC_LIB_DIR = STATIC_CANVAS_ROOT / "lib"


# ----------------------------------------------------------------------------
# Utilities
# ----------------------------------------------------------------------------

def slugify(text: str) -> str:
    lowered = text.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", lowered)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "canvas"


def read_note_frontmatter(note_path: Path) -> Tuple[Dict[str, object], str]:
    raw_text = note_path.read_text(encoding="utf-8")
    if raw_text.startswith("---\n"):
        fm_end = raw_text.find("\n---", 4)
        if fm_end == -1:
            raise SystemExit(f"✖ Could not find closing frontmatter delimiter in {note_path}")
        frontmatter = raw_text[4:fm_end]
        body = raw_text[fm_end + 4 :]
        data = yaml.safe_load(frontmatter) or {}
    else:
        data = {}
        body = raw_text

    if not isinstance(data, dict):
        raise SystemExit(f"✖ Unexpected frontmatter structure in {note_path}")

    return data, body


def write_note(note_path: Path, data: Dict[str, object], body: str) -> None:
    new_frontmatter = yaml.safe_dump(data, sort_keys=False).strip()
    note_path.write_text(f"---\n{new_frontmatter}\n---\n{body.lstrip()}", encoding="utf-8")


# ----------------------------------------------------------------------------
# Matching helpers
# ----------------------------------------------------------------------------

def canonical_key(text: str) -> str:
    simplified = re.sub(r"[\s_\-]+", " ", text.lower()).strip()
    return simplified

def build_note_indices() -> Tuple[Dict[str, Path], Dict[str, Path]]:
    canonical_map: Dict[str, Path] = {}
    slug_map: Dict[str, Path] = {}

    for md_path in CONTENT_ROOT.rglob("*.md"):
        key = canonical_key(md_path.stem)
        canonical_map.setdefault(key, md_path)

        data, _ = read_note_frontmatter(md_path)
        canvas_value = data.get("canvas")
        if isinstance(canvas_value, str) and canvas_value.strip():
            slug_map.setdefault(canonical_key(canvas_value), md_path)

    return canonical_map, slug_map


def locate_note(html_stem: str, canonical_map: Dict[str, Path], slug_map: Dict[str, Path]) -> Optional[Path]:
    canonical_name = canonical_key(html_stem)
    if canonical_name in canonical_map:
        return canonical_map[canonical_name]

    slug_candidate = canonical_key(slugify(html_stem))
    if slug_candidate in slug_map:
        return slug_map[slug_candidate]

    return None


# ----------------------------------------------------------------------------
# Export processing
# ----------------------------------------------------------------------------

@dataclass
class ExportRecord:
    source_html: Path
    dest_html: Path
    original_name: str
    slug: str
    note_path: Optional[Path]


def rewrite_asset_paths(html_body: str, asset_aliases: Sequence[str]) -> str:
    seen_aliases = []
    for alias in asset_aliases:
        cleaned = alias.strip().strip("/")
        if cleaned and cleaned not in seen_aliases:
            seen_aliases.append(cleaned)

    if "lib" not in seen_aliases:
        seen_aliases.append("lib")

    for alias in seen_aliases:
        replacements = {
            f'href="./{alias}/': 'href="../lib/',
            f"href='./{alias}/": "href='../lib/",
            f'src="./{alias}/': 'src="../lib/',
            f"src='./{alias}/": "src='../lib/",
            f'href="{alias}/': 'href="../lib/',
            f"href='{alias}/": "href='../lib/",
            f'src="{alias}/': 'src="../lib/',
            f"src='{alias}/": "src='../lib/",
        }
        for old, new in replacements.items():
            html_body = html_body.replace(old, new)

        alias_pattern = re.escape(alias)
        html_body = re.sub(rf"url\((['\"]?)(?:\./)?{alias_pattern}/", r"url(\1../lib/", html_body)

    return html_body


def prepare_exports(
    html_paths: Iterable[Path],
    canonical_map: Dict[str, Path],
    slug_map: Dict[str, Path],
) -> Iterable[ExportRecord]:
    for html_path in sorted(html_paths):
        note_path = locate_note(html_path.stem, canonical_map, slug_map)
        slug = slugify(html_path.stem)
        dest_html = STATIC_HTML_DIR / f"{slug}.html"
        yield ExportRecord(html_path, dest_html, html_path.stem, slug, note_path)


def copy_html(record: ExportRecord, asset_aliases: Sequence[str]) -> None:
    STATIC_HTML_DIR.mkdir(parents=True, exist_ok=True)
    html_body = record.source_html.read_text(encoding="utf-8")
    patched = rewrite_asset_paths(html_body, asset_aliases)
    record.dest_html.write_text(patched, encoding="utf-8")


def copy_libs(source_lib_dir: Path, dest_lib_dir: Path) -> None:
    if dest_lib_dir.exists():
        shutil.rmtree(dest_lib_dir)
    shutil.copytree(source_lib_dir, dest_lib_dir)

    html_local_lib = STATIC_HTML_DIR / "lib"
    if html_local_lib.exists():
        shutil.rmtree(html_local_lib)
    shutil.copytree(source_lib_dir, html_local_lib)


def update_note_frontmatter(note_path: Path, slug: str) -> bool:
    data, body = read_note_frontmatter(note_path)
    existing = data.get("canvas")
    if isinstance(existing, str) and existing.strip() == slug:
        return False

    data["canvas"] = slug
    data.setdefault(
        "canvasDescription",
        f"Interactive canvas export for {note_path.stem.strip()}",
    )
    write_note(note_path, data, body)
    return True


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------


def run_validator(skip: bool) -> None:
    if skip:
        print("• Skipped validator per --skip-validate")
        return

    subprocess.run(
        ["npm", "run", "validate:canvases"],
        cwd=REPO_ROOT,
        check=True,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Copy Webpage HTML Export outputs into Quartz static assets and update notes.",
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_EXPORT_ROOT,
        help="Directory containing the plugin export (defaults to the repository's Canvas/ folder)",
    )
    parser.add_argument(
        "--skip-validate",
        action="store_true",
        help="Skip running npm run validate:canvases after syncing.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    source_root: Path = args.source.expanduser().resolve()
    html_dir = source_root / "html"
    use_root_as_html = not html_dir.exists()
    html_search_dir = source_root if use_root_as_html else html_dir
    if use_root_as_html:
        html_paths = list(html_search_dir.glob("*.html"))
    else:
        html_paths = list(html_search_dir.rglob("*.html"))

    if not html_paths:
        try:
            expected_location = html_search_dir.relative_to(REPO_ROOT)
        except ValueError:
            expected_location = html_search_dir
        raise SystemExit(
            "✖ No HTML exports detected. Expected to find *.html files under "
            f"{expected_location}."
        )

    lib_dir = None
    for candidate in (source_root / "lib", source_root / "site-lib"):
        if candidate.exists():
            lib_dir = candidate
            break

    if lib_dir is None:
        raise SystemExit(
            "✖ Could not locate a lib/ or site-lib/ directory alongside the exports."
        )

    canonical_map, slug_map = build_note_indices()
    exports = list(prepare_exports(html_paths, canonical_map, slug_map))

    asset_aliases: Sequence[str] = (lib_dir.name, "lib") if lib_dir.name != "lib" else ("lib",)

    copied_html = 0
    updated_notes = 0

    for record in exports:
        copy_html(record, asset_aliases)
        copied_html += 1
        if record.note_path:
            if update_note_frontmatter(record.note_path, record.slug):
                updated_notes += 1
                rel_note = record.note_path.relative_to(REPO_ROOT)
                print(f"  ↻ Updated canvas frontmatter in {rel_note}")
        else:
            print(f"  ⚠ No matching note found for export '{record.original_name}'.")

    copy_libs(lib_dir, STATIC_LIB_DIR)

    print(f"• Copied {copied_html} canvas HTML export(s) to {STATIC_HTML_DIR.relative_to(REPO_ROOT)}.")
    refreshed_assets_msg = (
        f"• Refreshed lib assets from '{lib_dir.name}' under "
        f"{STATIC_LIB_DIR.relative_to(REPO_ROOT)} (and html/lib fallback)."
    )
    print(refreshed_assets_msg)
    if updated_notes:
        print(f"• Updated canvas frontmatter in {updated_notes} note(s).")

    try:
        run_validator(args.skip_validate)
    except subprocess.CalledProcessError as exc:
        sys.exit(exc.returncode)

    print("✨ Done. Canvas plugin exports synchronized.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("Interrupted")
