const fs = require('fs');
const path = require('path');
const { transform } = require('lightningcss');

const sourcePath = path.join(__dirname, 'quartz', 'plugins', 'transformers', 'youtubeCommunityPosts.ts');
const source = fs.readFileSync(sourcePath, 'utf8');

const marker = 'const YT_COMMUNITY_CSS = `';
const startIndex = source.indexOf(marker);
if (startIndex === -1) {
  console.error('Failed to locate YouTube CSS definition');
  process.exit(1);
}

const endMarker = '\r\n`\r\n\r\nexport const YouTubeCommunityPosts';
const endIndex = source.indexOf(endMarker, startIndex);
if (endIndex === -1) {
  console.error('Failed to locate end of YouTube CSS definition');
  process.exit(1);
}

const css = source.slice(startIndex + marker.length, endIndex);

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
  console.log('YouTube CSS transform succeeded');
} catch (error) {
  console.error('YouTube CSS transform failed');
  console.error(error);
}
