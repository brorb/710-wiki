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

## Railway deployment

Railway reads `railway.toml` to build and serve the site:

- Build command: `npm install && npm run build`
- Start command: `npm run start`

Connect this repository to a Railway service that honors `railway.toml`; the service will run the build script (which installs and builds Quartz) and serve the generated `quartz-site/public/` directory with standard static hosting (no SPA fallback).

> **Performance note:** Quartz's expensive `CustomOgImages` plugin is disabled in `quartz.config.ts` to keep rebuilds fast. Re-enable it if you need per-page social preview images, but expect longer build times.