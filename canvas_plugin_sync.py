#!/usr/bin/env python3
"""Synchronize Obsidian Webpage HTML Export canvases into the Quartz static folder."""
from __future__ import annotations

import argparse
import html
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Dict, Iterable, Optional, Sequence, Tuple

import yaml

REPO_ROOT = Path(__file__).resolve().parent
CONTENT_ROOT = REPO_ROOT / "Content"
DEFAULT_EXPORT_ROOT = REPO_ROOT / "Canvas"
STATIC_CANVAS_ROOT = REPO_ROOT / "quartz-site" / "quartz" / "static" / "canvas"
STATIC_HTML_DIR = STATIC_CANVAS_ROOT / "html"
STATIC_LIB_DIR = STATIC_CANVAS_ROOT / "lib"
SITE_PUBLIC_ROOT = REPO_ROOT / "quartz-site" / "public"

CANVAS_HTML_REL_ROOT = "../../../"

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"}
AUDIO_EXTENSIONS = {".mp3", ".wav", ".ogg", ".flac", ".m4a"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov"}


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
    trimmed_body = body.lstrip("\n")
    note_path.write_text(f"---\n{new_frontmatter}\n---\n{trimmed_body}", encoding="utf-8")


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


def sanitize_site_path(vault_path: str) -> str:
    posix = PurePosixPath(vault_path.strip("/"))
    sanitized_parts = [re.sub(r"\s+", "-", part) for part in posix.parts]
    sanitized = "/".join(sanitized_parts)
    if sanitized.lower().endswith(".md"):
        sanitized = sanitized[:-3] + ".html"
    return sanitized


def site_relative_url(vault_path: str) -> Optional[str]:
    sanitized = sanitize_site_path(vault_path)
    candidate = SITE_PUBLIC_ROOT / sanitized
    if not candidate.exists():
        return None
    return f"{CANVAS_HTML_REL_ROOT}{sanitized}"


def resolve_repo_asset_path(vault_path: str) -> Optional[Path]:
    posix = PurePosixPath(vault_path.strip("/"))
    if not posix.parts:
        return None
    if posix.parts[0].lower() == "media":
        candidate = REPO_ROOT / Path(*posix.parts)
    else:
        candidate = CONTENT_ROOT / Path(*posix.parts)
    return candidate if candidate.exists() else None


def extract_preview_text(markdown_body: str, limit: int = 200) -> str:
    text = markdown_body.strip()
    if not text:
        return ""

    substitutions = [
        (r"\[\[([^\]]+)\]\]", r"\1"),
        (r"\[([^\]]+)\]\([^\)]+\)", r"\1"),
        (r"`([^`]+)`", r"\1"),
        (r"\*\*([^*]+)\*\*", r"\1"),
        (r"__([^_]+)__", r"\1"),
        (r"\*([^*]+)\*", r"\1"),
        (r"_([^_]+)_", r"\1"),
    ]
    for pattern, repl in substitutions:
        text = re.sub(pattern, repl, text)

    text = re.sub(r"^>\s?", "", text, flags=re.MULTILINE)
    text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s+", " ", text).strip()

    if len(text) <= limit:
        return text

    truncated = text[:limit].rstrip()
    if not truncated.endswith("…"):
        truncated += "…"
    return truncated


def build_embed_markup(vault_path: str) -> Optional[str]:
    rel_url = site_relative_url(vault_path)
    extension = Path(vault_path).suffix.lower()

    if extension == ".md":
        note_path = resolve_repo_asset_path(vault_path)
        if note_path is None:
            return None
        frontmatter, body = read_note_frontmatter(note_path)
        title = frontmatter.get("title")
        if not isinstance(title, str) or not title.strip():
            title = note_path.stem.replace("-", " ")
        excerpt = extract_preview_text(body)
        link_target = rel_url or f"{CANVAS_HTML_REL_ROOT}{sanitize_site_path(vault_path)}"
        inner_html = (
            f'<a class="canvas-portal-card" href="{link_target}" target="_self" rel="noopener" '
            'style="display:flex;flex-direction:column;gap:0.5rem;padding:1rem;border:1px solid var(--background-modifier-border, rgba(0,0,0,0.1));'
            'background:var(--background-secondary, rgba(0,0,0,0.03));color:inherit;text-decoration:none;border-radius:10px;'
            'height:100%;box-sizing:border-box;overflow:hidden;">'
            f'<span style="font-weight:600;font-size:1.1em;line-height:1.2;">{html.escape(title.strip())}</span>'
        )
        if excerpt:
            inner_html += f'<span style="font-size:0.9em;line-height:1.4;">{html.escape(excerpt)}</span>'
        else:
            inner_html += '<span style="font-size:0.9em;opacity:0.75;">Open note</span>'
        inner_html += '</a>'
    elif extension in IMAGE_EXTENSIONS and rel_url:
        inner_html = (
            f'<img src="{rel_url}" alt="{html.escape(Path(vault_path).stem)}" '
            'style="width:100%;height:100%;object-fit:contain;"/>'
        )
    elif extension in AUDIO_EXTENSIONS and rel_url:
        inner_html = (
            f'<audio controls preload="metadata" style="width:100%;">'
            f'<source src="{rel_url}"/>Your browser does not support the audio element.'
            '</audio>'
        )
    elif extension in VIDEO_EXTENSIONS and rel_url:
        inner_html = (
            f'<video controls style="width:100%;height:100%;">'
            f'<source src="{rel_url}"/>Your browser does not support the video element.'
            '</video>'
        )
    elif rel_url:
        inner_html = (
            f'<a href="{rel_url}" target="_blank" rel="noopener" '
            'style="display:inline-flex;align-items:center;gap:0.5rem;">'
            f'<span style="font-weight:600;">{html.escape(Path(vault_path).name)}</span>'
            '<span style="font-size:0.85em;opacity:0.7;">Open attachment</span>'
            '</a>'
        )
    else:
        return None

    return (
        '<div class="canvas-node-content markdown-embed">'
        '<div class="markdown-embed-content node-insert-event">'
        f"{inner_html}"
        '</div></div></div>'
    )


def inject_missing_embeds(html_body: str) -> str:
    pattern = re.compile(
        r'<div class="canvas-node-content mod-canvas-empty">.*?<div class="canvas-empty-embed-label">“(?P<path>[^”]+)” could not be found\.</div>.*?</div></div></div>',
        re.DOTALL,
    )

    def replacer(match: re.Match[str]) -> str:
        vault_path = match.group("path")
        replacement = build_embed_markup(vault_path)
        if replacement is None:
            return match.group(0)
        return replacement

    return pattern.sub(replacer, html_body)


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
    patched = inject_missing_embeds(patched)
    record.dest_html.write_text(patched, encoding="utf-8")


def copy_libs(source_lib_dir: Path, alias_names: Sequence[str]) -> None:
    aliases = list(dict.fromkeys([*alias_names, "lib"]))

    for alias in aliases:
        static_target = STATIC_CANVAS_ROOT / alias
        if static_target.exists():
            shutil.rmtree(static_target)
        shutil.copytree(source_lib_dir, static_target)

        html_target = STATIC_HTML_DIR / alias
        if html_target.exists():
            shutil.rmtree(html_target)
        shutil.copytree(source_lib_dir, html_target)


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

    copy_libs(lib_dir, asset_aliases)

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
