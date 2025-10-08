# 7/10 Tone Sleuth Wiki

This is the information hub

## Quartz site

The `quartz-site/` directory contains the Quartz static-site generator that renders this vault. To build locally:

```bash
npm install
npm run build
```

The build script installs dependencies within `quartz-site/`, rebuilds using four parsing threads, and the generated site appears in `quartz-site/public/`.
For local incremental editing use `npm run preview`, which serves the site with hot reload and watches for Markdown changes.

### Canvas integration

Interactive canvases from Obsidian live alongside the Markdown notes under `Content/`. Use the helper script to keep everything in sync:

1. Install the Python dependency once:

	```bash
	pip install -r requirements.txt
	```

2. Run the integrator on any `.canvas` file:

	```bash
	python canvas_integrator.py Content/Puzzles/Parting\ Gifts\ Puzzle.canvas
	```

The script will:

- Generate a self-contained HTML viewer in `quartz-site/static/canvas/html/` (no Obsidian plugin export needed).
- Update the matching Markdown note's frontmatter with the `canvas` slug and a default description (or use `--description` to override).
- Run `npm run validate:canvases` so deployment catches mismatches early.

Advanced options are available via `python canvas_integrator.py --help` (custom slug, explicit note path, skip validation, etc.).

> Prefer the script for new canvases. Manual exports produced by Obsidian's **Webpage HTML Export** plugin will still work—drop the HTML in `quartz-site/static/canvas/html/`, keep any `lib/` assets under `quartz-site/static/canvas/lib/`, and reference the export name via the `canvas` frontmatter key.

During `npm run build`, a validation step ensures every note declaring a canvas has a matching exported HTML file and flags unused `.canvas` files so you can re-export them (either through the Python script or manual method) before deploying.

## Railway deployment

Railway reads `railway.toml` to build and serve the site:

- Build command: `npm install && npm run build`
- Start command: `npm run start`

Connect this repository to a Railway service that honors `railway.toml`; the service will run the build script (which installs and builds Quartz) and serve the generated `quartz-site/public/` directory with standard static hosting (no SPA fallback).

> **Performance note:** Quartz's expensive `CustomOgImages` plugin is disabled in `quartz.config.ts` to keep rebuilds fast. Re-enable it if you need per-page social preview images, but expect longer build times.