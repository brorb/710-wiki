const { transform } = require('lightningcss');

const css = `
.discord-thread-fade {
  background: linear-gradient(
    to bottom,
    rgba(43, 45, 49, 0) 0%,
    rgba(43, 45, 49, 0.72) 52%,
    color-mix(in srgb, rgba(43, 45, 49, 0.9) 30%, var(--color-primary-background) 70%) 78%,
    var(--color-primary-background) 100%
  );
}
`;

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
  console.log('Transform succeeded');
  console.log(result.code.toString());
} catch (error) {
  console.error('Transform failed');
  console.error(error);
}
