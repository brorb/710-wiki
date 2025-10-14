const colors = [
  { src: [0, 0, 0], dst: [0, 0, 0], weight: 200 },
  { src: [1, 1, 1], dst: [1, 1, 1], weight: 200 },
  { src: [0.5, 0.5, 0.5], dst: [0.5, 0.5, 0.5], weight: 12 },
  { src: [0.2, 0.2, 0.2], dst: [0.2, 0.2, 0.2], weight: 12 },
  { src: [0.8, 0.8, 0.8], dst: [0.8, 0.8, 0.8], weight: 12 },
  { src: [1, 0, 0], dst: [1, 0, 0], weight: 8 },
  { src: [0, 1, 0], dst: [0, 1, 0], weight: 8 },
  { src: [0, 0, 1], dst: [0, 0, 1], weight: 8 },
  {
    src: [0x58 / 255, 0x65 / 255, 0xf2 / 255],
    dst: [0xb7 / 255, 0x10 / 255, 0x02 / 255],
    weight: 120,
  },
];

const rows = [];
const rhs = [];

for (const { src, dst, weight } of colors) {
  const w = Math.sqrt(weight);
  const [r, g, b] = src;
  const vec = [r, g, b, 1];
  for (let channel = 0; channel < 3; channel++) {
    const row = new Array(12).fill(0);
    for (let k = 0; k < 4; k++) {
      row[channel * 4 + k] = vec[k] * w;
    }
    rows.push(row);
    rhs.push(dst[channel] * w);
  }
}

// Solve least squares using normal equations
const m = rows[0].length;
const normal = Array.from({ length: m }, () => new Array(m).fill(0));
const normalRhs = new Array(m).fill(0);

for (let i = 0; i < rows.length; i++) {
  const row = rows[i];
  for (let j = 0; j < m; j++) {
    normalRhs[j] += row[j] * rhs[i];
    for (let k = 0; k < m; k++) {
      normal[j][k] += row[j] * row[k];
    }
  }
}

function solveSymmetric(matrix, vector) {
  const size = matrix.length;
  const aug = matrix.map((row, i) => row.concat(vector[i]));

  for (let col = 0; col < size; col++) {
    // pivot
    let pivot = col;
    for (let row = col + 1; row < size; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[pivot][col])) {
        pivot = row;
      }
    }
    if (Math.abs(aug[pivot][col]) < 1e-10) continue;
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]];
    const pivotVal = aug[col][col];
    for (let j = col; j <= size; j++) {
      aug[col][j] /= pivotVal;
    }
    for (let row = 0; row < size; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      if (factor === 0) continue;
      for (let j = col; j <= size; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  return aug.map((row) => row[size]);
}

const solution = solveSymmetric(normal, normalRhs);

console.log('solution', solution);

function matrixToCSS(values) {
  return values
    .map((v) => Number(v.toFixed(6)))
    .join(' ');
}

const filterValues = [
  solution.slice(0, 4),
  solution.slice(4, 8),
  solution.slice(8, 12),
  [0, 0, 0, 1],
].flat();

console.log('css matrix:', matrixToCSS(filterValues));

function testColor(src) {
  const vec = [src[0], src[1], src[2], 1];
  const out = [0, 0, 0];
  for (let channel = 0; channel < 3; channel++) {
    const row = solution.slice(channel * 4, channel * 4 + 4);
    out[channel] = row.reduce((sum, coeff, idx) => sum + coeff * vec[idx], 0);
  }
  return out;
}

for (const color of colors) {
  console.log('test', color.src, '->', testColor(color.src));
}
