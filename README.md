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

We rely exclusively on Obsidian's **Webpage HTML Export** plugin so the live site matches what you design in Obsidian (iframes, scripts, embeds, etc.).

1. **Export from Obsidian**
   - Install/enable the Webpage HTML Export plugin.
   - Choose the **Online Web Serve** export mode and target the repository's top-level `Canvas/` folder. The plugin should produce:

	   ```text
	   Canvas/
	     html/
	       your-canvas.html
	       other-canvas.html
	     lib/
	       scripts/
	       styles/
	       …
	   ```

2. **Sync the exports into Quartz**

	```bash
	# from the repository root
	python canvas_plugin_sync.py
	```

   - First time using the repo? Install the tiny Python dependency once with `pip install -r requirements.txt`.
   - Optionally pass `--source /path/to/export` if you staged the plugin export somewhere else.
   - Use `--skip-validate` only if you intentionally want to skip the post-sync safety check.

3. **What the sync script does**

   - Copies each HTML file into `quartz-site/quartz/static/canvas/html/`, slugifying names so Quartz can refer to them cleanly.
   - Mirrors the `lib/` assets to `quartz-site/quartz/static/canvas/lib/` (and drops a fallback copy in `.../html/lib/` so relative URLs continue to work).
   - Updates matching Markdown notes in `Content/` so their frontmatter `canvas` field points at the slugged export (creating a default description when absent).
   - Runs `npm run validate:canvases` to confirm every referenced canvas has a matching export.

4. **Deploy**

   - Rebuild Quartz (`npm run build -w quartz-site`) and push/deploy as usual.
   - The `Canvas.tsx` component automatically renders any page whose frontmatter contains `canvas: <slug>`.

Pro tip: append the sync command to your personal export workflow (e.g., a shell script or Obsidian hotkey) so every plugin export is one CLI away from the live site. The helper only touches exported assets and frontmatter; your Markdown content under `Content/` stays untouched otherwise.

During `npm run build`, a validation step ensures every note declaring a canvas has a matching exported HTML file and flags unused `.canvas` files so you can re-export them (either through the Python script or manual method) before deploying.

## Railway deployment

Railway reads `railway.toml` to build and serve the site:

- Build command: `npm install && npm run build`
- Start command: `npm run start`

Connect this repository to a Railway service that honors `railway.toml`; the service will run the build script (which installs and builds Quartz) and serve the generated `quartz-site/public/` directory with standard static hosting (no SPA fallback).

> **Performance note:** Quartz's expensive `CustomOgImages` plugin is disabled in `quartz.config.ts` to keep rebuilds fast. Re-enable it if you need per-page social preview images, but expect longer build times.