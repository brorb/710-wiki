#!/usr/bin/env python3
"""Canvas automation helper for the 710 wiki."""
from __future__ import annotations

import argparse
import html
import json
import math
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import quote

import yaml

REPO_ROOT = Path(__file__).resolve().parent
CONTENT_ROOT = REPO_ROOT / "Content"
STATIC_CANVAS_ROOT = REPO_ROOT / "quartz-site" / "quartz" / "static" / "canvas"
HTML_OUTPUT_DIR = STATIC_CANVAS_ROOT / "html"


@dataclass
class CanvasNode:
    id: str
    type: str
    x: float
    y: float
    width: float
    height: float
    raw: Dict[str, Any]

    @property
    def center(self) -> tuple[float, float]:
        return (self.x + self.width / 2.0, self.y + self.height / 2.0)


@dataclass
class CanvasEdge:
    id: str
    from_node: str
    to_node: str
    label: Optional[str]
    style: Dict[str, Any]


@dataclass
class CanvasTask:
  canvas_path: Path
  slug: str
  note_path: Optional[Path]
  note_data: Optional[Dict[str, Any]]
  note_body: Optional[str]
  description_override: Optional[str]

  @property
  def html_path(self) -> Path:
    return HTML_OUTPUT_DIR / f"{self.slug}.html"


# Soft palette that roughly mirrors Obsidian's default canvas colors.
CANVAS_COLORS = {
    "0": ("#0f172a", "#e2e8f0"),
    "1": ("#991b1b", "#fef2f2"),
    "2": ("#9a3412", "#fff7ed"),
    "3": ("#854d0e", "#fef3c7"),
    "4": ("#166534", "#ecfdf5"),
    "5": ("#0f766e", "#f0fdfa"),
    "6": ("#115e59", "#f0fdfa"),
    "7": ("#1d4ed8", "#eff6ff"),
    "8": ("#4338ca", "#eef2ff"),
    "9": ("#6b21a8", "#f5f3ff"),
    "10": ("#c026d3", "#fdf4ff"),
    "11": ("#be123c", "#fff1f2"),
    "12": ("#292524", "#f5f5f4"),
}

COLOR_DEFAULT = ("#0f172a", "#e2e8f0")


def slugify(text: str) -> str:
    lowered = text.lower()
    # Replace all non alphanumeric characters with hyphen.
    slug = re.sub(r"[^a-z0-9]+", "-", lowered)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "canvas"


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(
    description="Convert Obsidian .canvas files into embeddable HTML viewers "
    "and update the matching Quartz note frontmatter."
  )
  parser.add_argument(
    "canvas_path",
    nargs="?",
    help="Path to a specific .canvas file. If omitted, the script scans the vault "
    "for canvases that need integration.",
  )
  parser.add_argument(
    "--note",
    help="Path to the Markdown file that should reference this canvas."
    " If omitted, the script will look for a .md file with the same stem",
  )
  parser.add_argument(
    "--slug",
    help="Optional override for the generated canvas slug. Defaults to the canvas file name.",
  )
  parser.add_argument(
    "--description",
    help="Optional description for the canvasDescription frontmatter (falls back to a sensible default).",
  )
  parser.add_argument(
    "--skip-validate",
    action="store_true",
    help="Skip running the canvas validator after generating the HTML.",
  )
  parser.add_argument(
    "--force",
    action="store_true",
    help="Regenerate exports even if they appear up to date (useful when running across the whole vault).",
  )
  return parser.parse_args()


def load_canvas(path: Path) -> Dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"✖ Failed to parse {path}: {exc}") from exc


def find_note_path(canvas_path: Path, explicit_note: Optional[str]) -> Optional[Path]:
    if explicit_note:
        note_path = Path(explicit_note).expanduser().resolve()
        if not note_path.exists():
            raise SystemExit(f"✖ Markdown note {note_path} does not exist")
        return note_path

    candidate = canvas_path.with_suffix(".md")
    if candidate.exists():
        return candidate

    # Look for a sibling markdown file with same stem but ignoring case/spaces.
    normalized_stem = re.sub(r"\s+", " ", canvas_path.stem.lower()).strip()
    for md_path in canvas_path.parent.glob("*.md"):
        candidate_stem = re.sub(r"\s+", " ", md_path.stem.lower()).strip()
        if candidate_stem == normalized_stem:
            return md_path
    return None


def map_nodes(raw_nodes: Iterable[Dict[str, Any]]) -> Dict[str, CanvasNode]:
    nodes: Dict[str, CanvasNode] = {}
    for raw in raw_nodes:
        node_id = raw.get("id")
        node_type = raw.get("type", "text")
        if not node_id:
            continue
        width = float(raw.get("width", 280))
        height = float(raw.get("height", 160))
        x = float(raw.get("x", 0.0))
        y = float(raw.get("y", 0.0))
        nodes[node_id] = CanvasNode(
            id=node_id,
            type=node_type,
            x=x,
            y=y,
            width=width,
            height=height,
            raw=raw,
        )
    return nodes


def map_edges(raw_edges: Iterable[Dict[str, Any]]) -> List[CanvasEdge]:
    edges: List[CanvasEdge] = []
    for entry in raw_edges:
        edge_id = entry.get("id")
        from_node = entry.get("fromNode")
        to_node = entry.get("toNode")
        if not edge_id or not from_node or not to_node:
            continue
        edges.append(
            CanvasEdge(
                id=edge_id,
                from_node=from_node,
                to_node=to_node,
                label=entry.get("label"),
                style=entry.get("styleAttributes", {}),
            )
        )
    return edges


def compute_bounds(nodes: Dict[str, CanvasNode]) -> Dict[str, float]:
    if not nodes:
        return {"min_x": 0.0, "min_y": 0.0, "width": 1024.0, "height": 768.0}
    min_x = min(node.x for node in nodes.values())
    min_y = min(node.y for node in nodes.values())
    max_x = max(node.x + node.width for node in nodes.values())
    max_y = max(node.y + node.height for node in nodes.values())
    margin = 240.0
    return {
        "min_x": min_x - margin,
        "min_y": min_y - margin,
        "width": (max_x - min_x) + margin * 2.0,
        "height": (max_y - min_y) + margin * 2.0,
    }


def escape_text(text: str) -> str:
    escaped = html.escape(text)
    escaped = escaped.replace("\n", "<br />")

    # Convert bare URLs into anchors.
    url_regex = re.compile(r"(https?://[\w\-./#?=&%+:]+)")

    def linkify(match: re.Match[str]) -> str:
        url = match.group(1)
        return f'<a href="{url}" target="_blank" rel="noopener">{url}</a>'

    escaped = url_regex.sub(linkify, escaped)

    # Convert Obsidian wikilinks [[Target]].
    def replace_wikilink(match: re.Match[str]) -> str:
        target = match.group(1).strip()
        href = "/" + "/".join(slugify(part) for part in target.split("/")) + "/"
        return f'<a class="wikilink" href="{href}">{html.escape(target)}</a>'

    escaped = re.sub(r"\[\[([^\]]+)\]\]", replace_wikilink, escaped)
    return escaped


def build_site_href(file_path: str) -> str:
    path = Path(file_path)
    parts: List[str]
    if path.suffix.lower() == ".md":
        parts = [slugify(part) for part in path.with_suffix("").parts]
        return "/" + "/".join(parts) + "/"
    parts = [quote(part) for part in path.parts]
    return "/" + "/".join(parts)


def render_node(node: CanvasNode, offsets: Dict[str, float]) -> str:
    x = node.x - offsets["min_x"]
    y = node.y - offsets["min_y"]
    width = node.width
    height = node.height
    background, foreground = COLOR_DEFAULT
    color_key = str(node.raw.get("color")) if node.raw.get("color") is not None else None
    if color_key and color_key in CANVAS_COLORS:
        background, foreground = CANVAS_COLORS[color_key]

    style_attrs = node.raw.get("styleAttributes", {})
    text_align = style_attrs.get("textAlign")
    align_css = f"text-align: {text_align};" if text_align else ""

    base_style = (
        f"left: {x}px; top: {y}px; width: {width}px; height: {height}px;"
        f"background: {background}; color: {foreground};"
        f"{align_css}"
    )

    body_html: str

    if node.type == "text":
        body_html = escape_text(node.raw.get("text", ""))
    elif node.type == "file":
        file_target = node.raw.get("file", "")
        display = html.escape(Path(file_target).name)
        href = build_site_href(file_target)
        body_html = (
            f'<div class="file-card"><div class="file-icon">📄</div>'
            f'<div class="file-body"><a href="{href}" target="_top">{display}</a>'
            f'<div class="file-path">{html.escape(file_target)}</div>'
            f"</div></div>"
        )
    elif node.type == "link":
        url = node.raw.get("url", "")
        display = html.escape(url)
        body_html = (
            f'<div class="link-card"><div class="link-icon">🔗</div>'
            f'<a href="{display}" target="_blank" rel="noopener">{display}</a></div>'
        )
    else:
        body_html = (
            f'<pre class="unknown-node">Unsupported node type: {html.escape(node.type)}\n'
            f"{html.escape(json.dumps(node.raw, indent=2)[:800])}</pre>"
        )

    return (
        f'<article class="node node-{node.type}" style="{base_style}">'
        f"{body_html}</article>"
    )


def render_edge(edge: CanvasEdge, nodes: Dict[str, CanvasNode], offsets: Dict[str, float]) -> Optional[str]:
    from_node = nodes.get(edge.from_node)
    to_node = nodes.get(edge.to_node)
    if not from_node or not to_node:
        return None

    start_x, start_y = from_node.center
    end_x, end_y = to_node.center
    start_x -= offsets["min_x"]
    start_y -= offsets["min_y"]
    end_x -= offsets["min_x"]
    end_y -= offsets["min_y"]

    stroke = "#94a3b8"
    stroke_width = 2
    dash = edge.style.get("path")
    dash_array = ""
    if dash == "dashed":
        dash_array = " stroke-dasharray=\"8 8\""
    elif dash == "long-dashed":
        dash_array = " stroke-dasharray=\"16 14\""

    arrow = edge.style.get("arrow")
    marker = " marker-end=\"url(#arrowhead)\"" if arrow else ""

    line = (
        f'<line x1="{start_x:.2f}" y1="{start_y:.2f}" '
        f'x2="{end_x:.2f}" y2="{end_y:.2f}" '
        f'stroke="{stroke}" stroke-width="{stroke_width}"{dash_array}{marker} />'
    )

    if edge.label:
        mid_x = (start_x + end_x) / 2.0
        mid_y = (start_y + end_y) / 2.0 - 6
        label = html.escape(edge.label)
        line += f'<text x="{mid_x:.2f}" y="{mid_y:.2f}" class="edge-label">{label}</text>'
    return line


def generate_html(
    slug: str,
    canvas_data: Dict[str, Any],
    nodes: Dict[str, CanvasNode],
    edges: List[CanvasEdge],
    bounds: Dict[str, float],
) -> str:
    offsets = {"min_x": bounds["min_x"], "min_y": bounds["min_y"]}
    node_html = "\n".join(render_node(node, offsets) for node in nodes.values())

    edge_markup = []
    for edge in edges:
        rendered = render_edge(edge, nodes, offsets)
        if rendered:
            edge_markup.append(rendered)
    edges_html = "\n".join(edge_markup)

    serialized = json.dumps(canvas_data, indent=2)

    return f"""<!DOCTYPE html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>{html.escape(canvas_data.get('metadata', {}).get('frontmatter', {}).get('title', slug.title()))}</title>
    <style>
      :root {{
        color-scheme: dark;
      }}
      * {{
        box-sizing: border-box;
      }}
      body {{
        margin: 0;
        font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
        background: #0b1220;
        color: #e2e8f0;
        min-height: 100vh;
        display: grid;
        grid-template-rows: auto 1fr;
      }}
      header {{
        padding: 0.75rem 1.5rem;
        border-bottom: 1px solid rgba(148, 163, 184, 0.2);
        display: flex;
        align-items: center;
        gap: 1rem;
        background: rgba(15, 23, 42, 0.85);
        backdrop-filter: blur(8px);
        position: sticky;
        top: 0;
        z-index: 2;
      }}
      header h1 {{
        font-size: 1rem;
        font-weight: 600;
        margin: 0;
      }}
      header .actions {{
        display: flex;
        gap: 0.5rem;
        margin-left: auto;
      }}
      header button {{
        appearance: none;
        border: 1px solid rgba(148, 163, 184, 0.4);
        background: rgba(30, 41, 59, 0.8);
        color: inherit;
        border-radius: 0.5rem;
        padding: 0.35rem 0.75rem;
        cursor: pointer;
        transition: background 0.2s ease;
      }}
      header button:hover {{
        background: rgba(51, 65, 85, 0.9);
      }}
      #canvas-wrapper {{
        position: relative;
        overflow: hidden;
      }}
      #canvas-stage {{
        --tx: 0px;
        --ty: 0px;
        --scale: 1;
        width: {bounds['width']:.2f}px;
        height: {bounds['height']:.2f}px;
        transform-origin: 0 0;
        transform: translate(var(--tx), var(--ty)) scale(var(--scale));
        transition: transform 0.02s ease-out;
        position: relative;
        background-image: linear-gradient(rgba(30, 41, 59, 0.6) 1px, transparent 1px),
          linear-gradient(90deg, rgba(30, 41, 59, 0.6) 1px, transparent 1px);
        background-size: 48px 48px;
        background-position: 0 0;
      }}
      svg.edges {{
        position: absolute;
        inset: 0;
        width: {bounds['width']:.2f}px;
        height: {bounds['height']:.2f}px;
        pointer-events: none;
      }}
      .edge-label {{
        dominant-baseline: hanging;
        text-anchor: middle;
        font-size: 0.75rem;
        fill: #cbd5f5;
        paint-order: stroke;
        stroke: #0b1220;
        stroke-width: 3px;
      }}
      article.node {{
        position: absolute;
        border-radius: 16px;
        padding: 1rem;
        border: 1px solid rgba(148, 163, 184, 0.25);
        box-shadow: 0 18px 40px rgba(7, 12, 24, 0.35);
        overflow: hidden;
      }}
      article.node p {{
        margin: 0 0 0.75rem 0;
      }}
      article.node:last-child p {{
        margin-bottom: 0;
      }}
      .node-text {{
        font-size: 0.95rem;
        line-height: 1.55;
      }}
      .node-text a {{
        color: #38bdf8;
        text-decoration: underline;
      }}
      .wikilink {{
        color: #facc15;
        font-weight: 600;
      }}
      .file-card {{
        display: flex;
        gap: 0.75rem;
        align-items: flex-start;
      }}
      .file-card a {{
        color: inherit;
        text-decoration: underline;
      }}
      .file-icon {{
        font-size: 1.75rem;
      }}
      .file-path {{
        font-size: 0.75rem;
        opacity: 0.7;
        margin-top: 0.35rem;
        word-break: break-word;
      }}
      .link-card {{
        display: flex;
        align-items: center;
        gap: 0.75rem;
        font-size: 0.95rem;
      }}
      .link-icon {{
        font-size: 1.5rem;
      }}
      .unknown-node {{
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        font-size: 0.75rem;
        background: rgba(15, 23, 42, 0.65);
        padding: 0.75rem;
        border-radius: 0.75rem;
        height: 100%;
        overflow: auto;
      }}
      footer {{
        font-size: 0.75rem;
        padding: 0.75rem 1.5rem;
        color: rgba(148, 163, 184, 0.7);
        border-top: 1px solid rgba(148, 163, 184, 0.2);
        background: rgba(15, 23, 42, 0.85);
      }}
    </style>
  </head>
  <body>
    <header>
      <h1>{html.escape(slug.replace('-', ' ').title())}</h1>
      <div class=\"actions\">
        <button type=\"button\" data-action=\"zoom-in\">Zoom in</button>
        <button type=\"button\" data-action=\"zoom-out\">Zoom out</button>
        <button type=\"button\" data-action=\"reset\">Reset</button>
      </div>
    </header>
    <div id=\"canvas-wrapper\">
      <div id=\"canvas-stage\">
        <svg class=\"edges\" viewBox=\"0 0 {bounds['width']:.2f} {bounds['height']:.2f}\" preserveAspectRatio=\"xMinYMin meet\">
          <defs>
            <marker id=\"arrowhead\" markerWidth=\"10\" markerHeight=\"10\" refX=\"10\" refY=\"3\" orient=\"auto\">
              <polygon points=\"0 0, 10 3, 0 6\" fill=\"#94a3b8\" />
            </marker>
          </defs>
          {edges_html}
        </svg>
        {node_html}
      </div>
    </div>
    <footer>
      • Scroll to zoom, drag to pan. • Generated automatically by canvas_integrator.py.
    </footer>
    <script>
      const stage = document.getElementById('canvas-stage');
      const actions = document.querySelectorAll('header button[data-action]');
      let scale = 1;
      let offsetX = 0;
      let offsetY = 0;
      let isDragging = false;
      let dragStart = {{ x: 0, y: 0 }};

      function updateTransform() {{
        stage.style.setProperty('--scale', scale.toFixed(4));
        stage.style.setProperty('--tx', `${{offsetX.toFixed(2)}}px`);
        stage.style.setProperty('--ty', `${{offsetY.toFixed(2)}}px`);
      }}

      function clamp(value, min, max) {{
        return Math.min(Math.max(value, min), max);
      }}

      function zoom(factor, focusX, focusY) {{
        const prevScale = scale;
        scale = clamp(scale * factor, 0.25, 3.5);
        const scaleDelta = scale / prevScale;
        offsetX = focusX - (focusX - offsetX) * scaleDelta;
        offsetY = focusY - (focusY - offsetY) * scaleDelta;
        updateTransform();
      }}

      actions.forEach((button) => {{
        button.addEventListener('click', () => {{
          const action = button.dataset.action;
          if (action === 'zoom-in') {{
            zoom(1.2, window.innerWidth / 2, window.innerHeight / 2);
          }} else if (action === 'zoom-out') {{
            zoom(1 / 1.2, window.innerWidth / 2, window.innerHeight / 2);
          }} else if (action === 'reset') {{
            scale = 1;
            offsetX = 0;
            offsetY = 0;
            updateTransform();
          }}
        }});
      }});

      document.addEventListener('wheel', (event) => {{
        if (!event.shiftKey) {{
          event.preventDefault();
          const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
          zoom(factor, event.clientX, event.clientY);
        }}
      }}, {{ passive: false }});

      document.addEventListener('pointerdown', (event) => {{
        if (event.button !== 0) return;
        isDragging = true;
  dragStart = {{ x: event.clientX - offsetX, y: event.clientY - offsetY }};
        document.body.style.cursor = 'grabbing';
      }});

      document.addEventListener('pointermove', (event) => {{
        if (!isDragging) return;
        offsetX = event.clientX - dragStart.x;
        offsetY = event.clientY - dragStart.y;
        updateTransform();
      }});

      document.addEventListener('pointerup', () => {{
        isDragging = false;
        document.body.style.cursor = 'default';
      }});

      updateTransform();
    </script>
    <script id=\"canvas-json\" type=\"application/json\">{html.escape(serialized)}</script>
  </body>
</html>
"""


def write_html(slug: str, html_body: str) -> Path:
    HTML_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_path = HTML_OUTPUT_DIR / f"{slug}.html"
    if output_path.exists():
        output_path.unlink()
    output_path.write_text(html_body, encoding="utf-8")
    return output_path


def read_note_frontmatter(note_path: Path) -> tuple[Dict[str, Any], str]:
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


def update_note_frontmatter(
    note_path: Path,
    slug: str,
    description: Optional[str],
    data: Optional[Dict[str, Any]] = None,
    body: Optional[str] = None,
) -> None:
    if data is None or body is None:
        data, body = read_note_frontmatter(note_path)

    default_description = f"Interactive canvas export for {note_path.stem.strip()}"
    resolved_description = description or default_description

    data["canvas"] = slug
    data.setdefault("canvasDescription", resolved_description)

    new_frontmatter = yaml.safe_dump(data, sort_keys=False).strip()
    updated = f"---\n{new_frontmatter}\n---\n{body.lstrip()}"
    note_path.write_text(updated, encoding="utf-8")


def build_task(
    canvas_path: Path,
    note_override: Optional[str],
    slug_override: Optional[str],
    description_override: Optional[str],
) -> CanvasTask:
    note_path = find_note_path(canvas_path, note_override)
    note_data: Optional[Dict[str, Any]] = None
    note_body: Optional[str] = None
    existing_slug: Optional[str] = None

    if note_path:
        note_data, note_body = read_note_frontmatter(note_path)
        existing_value = note_data.get("canvas")
        if isinstance(existing_value, str) and existing_value.strip():
            existing_slug = existing_value.strip()

    slug = slug_override or existing_slug or slugify(canvas_path.stem)

    return CanvasTask(
        canvas_path=canvas_path,
        slug=slug,
        note_path=note_path,
        note_data=note_data,
        note_body=note_body,
        description_override=description_override,
    )


def should_process_task(task: CanvasTask, force: bool) -> bool:
    if force:
        return True

    html_path = task.html_path
    if not html_path.exists():
        return True

    if html_path.stat().st_mtime < task.canvas_path.stat().st_mtime:
        return True

    if task.note_path and task.note_data is not None:
        canvas_value = task.note_data.get("canvas")
        if not isinstance(canvas_value, str) or canvas_value.strip() != task.slug:
            return True
        if (
            task.description_override is not None
            and task.note_data.get("canvasDescription") != task.description_override
        ):
            return True

    return False


def integrate_task(task: CanvasTask) -> Path:
    canvas_data = load_canvas(task.canvas_path)
    nodes = map_nodes(canvas_data.get("nodes", []))
    edges = map_edges(canvas_data.get("edges", []))
    bounds = compute_bounds(nodes)

    html_body = generate_html(task.slug, canvas_data, nodes, edges, bounds)
    html_path = write_html(task.slug, html_body)

    try:
        canvas_rel = task.canvas_path.relative_to(REPO_ROOT)
    except ValueError:
        canvas_rel = task.canvas_path
    print(f"► Processing {canvas_rel}")

    if task.note_path:
        update_note_frontmatter(
            task.note_path,
            task.slug,
            task.description_override,
            task.note_data,
            task.note_body,
        )
        try:
            note_rel = task.note_path.relative_to(REPO_ROOT)
        except ValueError:
            note_rel = task.note_path
        print(f"  ├─ Updated note frontmatter: {note_rel}")
    else:
        print("  ├─ No matching Markdown note found. Skipping frontmatter update.")

    try:
        rel_html = html_path.relative_to(REPO_ROOT)
    except ValueError:
        rel_html = html_path
    print(f"  └─ Exported canvas viewer → {rel_html}")
    return html_path


def run_validator() -> None:
    print("› Running npm run validate:canvases to confirm the build will pass…")
    result = subprocess.run(
        ["npm", "run", "validate:canvases"],
        cwd=REPO_ROOT,
        check=False,
        text=True,
    )
    if result.returncode != 0:
        raise SystemExit("✖ Canvas validation failed. Check the output above for details.")


def main() -> None:
  args = parse_args()

  if args.canvas_path is None:
    if any([args.note, args.slug, args.description]):
      raise SystemExit(
        "✖ The --note, --slug, and --description options require specifying a canvas file path."
      )
    canvas_paths = sorted(path.resolve() for path in CONTENT_ROOT.rglob("*.canvas"))
    if not canvas_paths:
      print("• No .canvas files found under Content/.")
      return
    tasks = [build_task(path, None, None, None) for path in canvas_paths]
    force_flag = args.force
  else:
    canvas_path = Path(args.canvas_path).expanduser().resolve()
    if not canvas_path.exists():
      raise SystemExit(f"✖ Canvas file {canvas_path} does not exist")
    if canvas_path.suffix.lower() != ".canvas":
      raise SystemExit("✖ Input file must have the .canvas extension")

    tasks = [
      build_task(
        canvas_path,
        args.note,
        args.slug,
        args.description,
      )
    ]
    force_flag = True

  tasks_to_process: List[CanvasTask] = []
  skipped: List[CanvasTask] = []

  for task in tasks:
    if should_process_task(task, force_flag):
      tasks_to_process.append(task)
    else:
      skipped.append(task)

  if not tasks_to_process:
    if skipped:
      print("• All canvases are already integrated. Use --force to regenerate.")
    else:
      print("• No canvases matched the selection.")
    return

  for task in tasks_to_process:
    integrate_task(task)

  if not args.skip_validate:
    run_validator()
  else:
    print("• Skipped validator per --skip-validate")

  if skipped and not force_flag:
    print(f"• Skipped {len(skipped)} canvas export(s) that were already up to date.")

  print(f"✨ Done. Updated {len(tasks_to_process)} canvas export(s).")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("Interrupted")
