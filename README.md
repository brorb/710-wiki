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

Interactive canvases from Obsidian can be surfaced on the site:

1. In Obsidian, enable the **Webpage HTML Export** plugin.
2. Export the canvases you want to share using the plugin's **Online Web Server** mode.
3. Drop the exported bundle into `Content/Canvas/`, keeping the plugin's structure intact:
	- HTML files in `Content/Canvas/html/`
	- Supporting assets (`lib/` folder) in `Content/Canvas/lib/`
4. Create a note under `Content/canvases/` (one per canvas) and set the slug to match the exported HTML filename. Optionally add `canvas: exported-file-name` in frontmatter if they differ.

The layout automatically embeds the matching HTML file when visiting pages inside the `canvases/` folder. The spinner overlay hides once the iframe loads, and descriptive copy can be supplied via a `canvasDescription` frontmatter value.

## Railway deployment

Railway reads `railway.toml` to build and serve the site:

- Build command: `npm install && npm run build`
- Start command: `npm run start`

Connect this repository to a Railway service that honors `railway.toml`; the service will run the build script (which installs and builds Quartz) and serve the generated `quartz-site/public/` directory with standard static hosting (no SPA fallback).

> **Performance note:** Quartz's expensive `CustomOgImages` plugin is disabled in `quartz.config.ts` to keep rebuilds fast. Re-enable it if you need per-page social preview images, but expect longer build times.