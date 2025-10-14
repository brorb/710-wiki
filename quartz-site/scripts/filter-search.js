const clamp01 = (value) => Math.min(1, Math.max(0, value));

function applyFilters(rgb, filters) {
  let [r, g, b] = rgb.map((c) => c / 255);
  const [invert, sepia, saturate, hue, brightness, contrast] = filters;

  const inv = invert / 100;
  if (inv !== 0) {
    r = r * (1 - 2 * inv) + inv;
    g = g * (1 - 2 * inv) + inv;
    b = b * (1 - 2 * inv) + inv;
  }

  const sep = sepia / 100;
  if (sep !== 0) {
    const m = [
      0.393 + 0.607 * (1 - sep), 0.769 - 0.769 * (1 - sep), 0.189 - 0.189 * (1 - sep),
      0.349 + 0.651 * (1 - sep), 0.686 - 0.686 * (1 - sep), 0.168 - 0.168 * (1 - sep),
      0.272 + 0.728 * (1 - sep), 0.534 - 0.534 * (1 - sep), 0.131 - 0.131 * (1 - sep),
    ];
    const nr = clamp01(r * m[0] + g * m[1] + b * m[2]);
    const ng = clamp01(r * m[3] + g * m[4] + b * m[5]);
    const nb = clamp01(r * m[6] + g * m[7] + b * m[8]);
    r = nr;
    g = ng;
    b = nb;
  }

  const sat = saturate / 100;
  if (sat !== 1) {
    const m = [
      0.213 + 0.787 * sat, 0.715 - 0.715 * sat, 0.072 - 0.072 * sat,
      0.213 - 0.213 * sat, 0.715 + 0.285 * sat, 0.072 - 0.072 * sat,
      0.213 - 0.213 * sat, 0.715 - 0.715 * sat, 0.072 + 0.928 * sat,
    ];
    const nr = clamp01(r * m[0] + g * m[1] + b * m[2]);
    const ng = clamp01(r * m[3] + g * m[4] + b * m[5]);
    const nb = clamp01(r * m[6] + g * m[7] + b * m[8]);
    r = nr;
    g = ng;
    b = nb;
  }

  if (hue !== 0) {
    const rad = (hue * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const m = [
      0.213 + cos * 0.787 - sin * 0.213, 0.715 - cos * 0.715 - sin * 0.715, 0.072 - cos * 0.072 + sin * 0.928,
      0.213 - cos * 0.213 + sin * 0.143, 0.715 + cos * 0.285 + sin * 0.140, 0.072 - cos * 0.072 - sin * 0.283,
      0.213 - cos * 0.213 - sin * 0.787, 0.715 - cos * 0.715 + sin * 0.715, 0.072 + cos * 0.928 + sin * 0.072,
    ];
    const nr = clamp01(r * m[0] + g * m[1] + b * m[2]);
    const ng = clamp01(r * m[3] + g * m[4] + b * m[5]);
    const nb = clamp01(r * m[6] + g * m[7] + b * m[8]);
    r = nr;
    g = ng;
    b = nb;
  }

  const br = brightness / 100;
  if (br !== 1) {
    r = clamp01(r * br);
    g = clamp01(g * br);
    b = clamp01(b * br);
  }

  const ct = contrast / 100;
  if (ct !== 1) {
    r = clamp01((r - 0.5) * ct + 0.5);
    g = clamp01((g - 0.5) * ct + 0.5);
    b = clamp01((b - 0.5) * ct + 0.5);
  }

  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

const blurple = [0x58, 0x65, 0xf2];
const target = [0xb7, 0x10, 0x02];
const reference = [
  { src: [255, 255, 255], target: [255, 255, 255], weight: 5 },
  { src: [0, 0, 0], target: [0, 0, 0], weight: 8 },
  { src: [36, 36, 36], target: [36, 36, 36], weight: 6 },
  { src: [112, 112, 112], target: [112, 112, 112], weight: 4 },
  { src: [200, 200, 200], target: [200, 200, 200], weight: 3 },
];

const colorLoss = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

const initial = [0, 0, 100, 0, 100, 100];
let best = { filters: initial.slice(), loss: Infinity };
const bounds = [
  [0, 100],
  [0, 100],
  [0, 400],
  [-120, 120],
  [60, 140],
  [70, 160],
];

const randomCandidate = () =>
  bounds.map(([min, max]) => Math.random() * (max - min) + min);

const perturb = (filters, scale = 0.08) =>
  filters.map((value, idx) => {
    const [min, max] = bounds[idx];
    const span = max - min;
    const offset = (Math.random() * 2 - 1) * span * scale;
    return Math.max(min, Math.min(max, value + offset));
  });

const evaluate = (candidate) => {
  const blurpleOut = applyFilters(blurple, candidate);
  let loss = 25 * colorLoss(blurpleOut, target);

  for (const sample of reference) {
    const out = applyFilters(sample.src, candidate);
    loss += 40 * sample.weight * colorLoss(out, sample.target);
  }
  return { candidate, loss };
};

for (let iter = 0; iter < 250000; iter++) {
  const { candidate, loss } = evaluate(randomCandidate());
  if (loss < best.loss) {
    best = { filters: candidate, loss };
  }
}

for (let iter = 0; iter < 100000; iter++) {
  const { candidate, loss } = evaluate(perturb(best.filters, 0.02));
  if (loss < best.loss) {
    best = { filters: candidate, loss };
  }
}

console.log('best', best);
console.log('blurple ->', applyFilters(blurple, best.filters));
for (const sample of reference) {
  console.log(`${sample.src.join(',')} ->`, applyFilters(sample.src, best.filters));
}
console.log('filters:', `invert(${best.filters[0].toFixed(2)}%) sepia(${best.filters[1].toFixed(2)}%) saturate(${best.filters[2].toFixed(2)}%) hue-rotate(${best.filters[3].toFixed(2)}deg) brightness(${best.filters[4].toFixed(2)}%) contrast(${best.filters[5].toFixed(2)}%)`);
