const fs = require('fs');
const path = require('path');
const { transform } = require('lightningcss');

const sourcePath = path.join(__dirname, 'quartz', 'plugins', 'transformers', 'discordMessages.ts');
const source = fs.readFileSync(sourcePath, 'utf8');

const iconMatch = source.match(/const SHARE_ICON_MASK_URL = "([^"]+)"/);
const cssMatch = source.match(/const DISCORD_CSS = `([\s\S]*?)`\n/);

if (!cssMatch) {
  console.error('Failed to extract Discord CSS');
  process.exit(1);
}

let css = cssMatch[1];
if (iconMatch) {
  css = css.replace(/\$\{SHARE_ICON_MASK_URL\}/g, iconMatch[1]);
}

try {
  const result = transform({
    code: Buffer.from(css),
    minify: false,
    targets: {
      safari: (15 << 16) | (6 << 8),
      ios_saf: (15 << 16) | (6 << 8),
      edge: 115 << 16,
      firefox: 102 << 16,
      chrome: 109 << 16,
    },
  });
  console.log('Discord CSS transform succeeded');
} catch (error) {
  console.error('Discord CSS transform failed');
  console.error(error);
}
