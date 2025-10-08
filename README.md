# 7/10 Tone Sleuth Wiki

This is the information hub

## Quartz site

The `quartz-site/` directory contains the Quartz static-site generator that renders this vault. To build locally:

```bash
cd quartz-site
npm install
npm run build
```

The generated site appears in `quartz-site/public/`.

## Railway deployment

Railway reads `railway.toml` to build and serve the site:

- Build command: `cd quartz-site && npm install && npm run build`
- Start command: `npx serve -s quartz-site/public -l $PORT`

Connect this repository to a Railway service that honors `railway.toml`; the service will run the build from the Quartz workspace and serve the generated `public/` directory.