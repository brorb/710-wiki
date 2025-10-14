const clamp01 = (v) => Math.min(1, Math.max(0, v));

function applyFilters(rgb, filters) {
  let [r, g, b] = rgb.map((c) => c / 255);
  const [hue, saturate, brightness, contrast] = filters;

  if (hue !== 0) {
    const rad = (hue * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const m = [
      0.213 + 0.787 * cos - 0.213 * sin,
      0.715 - 0.715 * cos - 0.715 * sin,
      0.072 - 0.072 * cos + 0.928 * sin,
      0.213 - 0.213 * cos + 0.143 * sin,
      0.715 + 0.285 * cos + 0.140 * sin,
      0.072 - 0.072 * cos - 0.283 * sin,
      0.213 - 0.213 * cos - 0.787 * sin,
      0.715 - 0.715 * cos + 0.715 * sin,
      0.072 + 0.928 * cos + 0.072 * sin,
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
const neutrals = [
  { src: [0, 0, 0], dst: [0, 0, 0], weight: 5 },
  { src: [255, 255, 255], dst: [255, 255, 255], weight: 5 },
  { src: [120, 120, 120], dst: [120, 120, 120], weight: 3 },
  { src: [48, 48, 48], dst: [48, 48, 48], weight: 3 },
];

const loss = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

let best = { filters: [0, 100, 100, 100], loss: Infinity };

const randomCandidate = () => [
  Math.random() * 360 - 180,
  80 + Math.random() * 120,
  70 + Math.random() * 60,
  80 + Math.random() * 60,
];

const evaluate = (candidate) => {
  const blurpleOut = applyFilters(blurple, candidate);
  let total = 12 * loss(blurpleOut, target);
  for (const sample of neutrals) {
    total += sample.weight * loss(applyFilters(sample.src, candidate), sample.dst);
  }
  return { candidate, total };
};

for (let iter = 0; iter < 200000; iter++) {
  const cand = randomCandidate();
  const result = evaluate(cand);
  if (result.total < best.loss) {
    best = { filters: cand, loss: result.total };
  }
}

// Local refine around best
for (let scale = 20; scale > 0.05; scale *= 0.7) {
  for (let iter = 0; iter < 60000; iter++) {
    const perturbed = best.filters.map((value, idx) => {
      const range = scale;
      let delta = (Math.random() * 2 - 1) * range;
      if (idx === 1) delta *= 2;
      if (idx === 2) delta *= 1.5;
      if (idx === 3) delta *= 1.5;
      return value + delta;
    });
    const result = evaluate(perturbed);
    if (result.total < best.loss) {
      best = { filters: result.candidate, loss: result.total };
    }
  }
}

console.log('best', best);
console.log('blurple ->', applyFilters(blurple, best.filters));
for (const sample of neutrals) {
  console.log(sample.src.join(','), '->', applyFilters(sample.src, best.filters));
}
console.log('filters:', `hue-rotate(${best.filters[0].toFixed(2)}deg) saturate(${best.filters[1].toFixed(2)}%) brightness(${best.filters[2].toFixed(2)}%) contrast(${best.filters[3].toFixed(2)}%)`);
