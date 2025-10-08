# Deploying the 7/10 Tone Sleuth Wiki with Quartz + Railway

This repo hosts the Obsidian vault at the root and the Quartz toolchain in `quartz-site/`. Quartz is configured to read markdown from the parent directory so the vault contents publish without moving files around.

## Local preview

1. Install dependencies (once):
   ```bash
   cd quartz-site
   npm install
   ```
2. Build the site from the root vault:
   ```bash
   npm run build
   ```
   The output is emitted to `quartz-site/public/`.
3. Optional: run Quartz’s dev server while pointing at the root vault:
   ```bash
   npm run quartz -- build --serve -d ..
   ```

## Railway deployment

Create a **Static Site** service in Railway that tracks this GitHub repository and configure the following:

- **Build command:** `npm run build`
- **Publish directory:** `quartz-site/public`

Railway installs dependencies automatically (`npm install`) before running the build command. After the site is published you can attach a custom domain or use the generated Railway URL.

## Updating content

Any commits to the vault (outside `quartz-site/`) automatically rebuild when Railway redeploys. If you need to adjust Quartz behavior, edit `quartz-site/quartz.config.ts`. Future custom plugins—for example to render `.canvas` files—can live under `quartz-site/quartz/plugins/` and be registered in the config’s `plugins` section.
