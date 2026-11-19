/**
 * Minimal pure-TypeScript ISO/IEC 18004 QR Code matrix generator (Byte mode, ECC Level L, Versions 1-6).
 * Produces genuine scannable QR matrices for receipt verification (`CERVOS:RCP:...`) without native deps.
 */

// Version 1..6 capacities at ECC Level L: [size, totalDataCodewords, eccPerBlock, alignmentCenters]
const VERSIONS: ReadonlyArray<{
  version: number;
  size: number;
  dataCodewords: number;
  eccCodewords: number;
  align: readonly number[];
}> = [
  { version: 1, size: 21, dataCodewords: 19, eccCodewords: 7, align: [] },
  { version: 2, size: 25, dataCodewords: 34, eccCodewords: 10, align: [6, 18] },
  { version: 3, size: 29, dataCodewords: 55, eccCodewords: 15, align: [6, 22] },
  { version: 4, size: 33, dataCodewords: 80, eccCodewords: 20, align: [6, 26] },
  { version: 5, size: 37, dataCodewords: 108, eccCodewords: 26, align: [6, 30] },
  { version: 6, size: 41, dataCodewords: 136, eccCodewords: 36, align: [6, 34] },
];

// Two-block split only needed for v5/v6? Actually v5 L = 1 block (108 data, 26 ecc),
// v6 L = 2 blocks of (68 data, 18 ecc). Let's handle single & 2-block cleanly!
const BLOCK_LAYOUT: Record<number, { blocks: number; dataPerBlock: number; eccPerBlock: number }> = {
  1: { blocks: 1, dataPerBlock: 19, eccPerBlock: 7 },
  2: { blocks: 1, dataPerBlock: 34, eccPerBlock: 10 },
  3: { blocks: 1, dataPerBlock: 55, eccPerBlock: 15 },
  4: { blocks: 1, dataPerBlock: 80, eccPerBlock: 20 },
  5: { blocks: 1, dataPerBlock: 108, eccPerBlock: 26 },
  6: { blocks: 2, dataPerBlock: 68, eccPerBlock: 18 },
};

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly: Uint8Array = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: Uint8Array, eccLen: number): Uint8Array {
  const gen = rsGeneratorPoly(eccLen);
  const res = new Uint8Array(eccLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res[0];
    res.copyWithin(0, 1);
    res[eccLen - 1] = 0;
    for (let j = 0; j < eccLen; j++) {
      res[j] ^= gfMul(gen[j + 1], factor);
    }
  }
  return res;
}

function encodeBytes(text: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes.push(code <= 0xff ? code : 0x3f);
  }
  return new Uint8Array(bytes);
}

function buildCodewords(payload: Uint8Array, totalDataCodewords: number, version: number): Uint8Array {
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };

  // Mode: Byte (0100), Length (8 bits for v1-v9)
  pushBits(0b0100, 4);
  pushBits(payload.length, 8);
  for (const b of payload) pushBits(b, 8);

  const maxBits = totalDataCodewords * 8;
  const term = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < term; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const data = new Uint8Array(totalDataCodewords);
  for (let i = 0; i < bits.length / 8; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i * 8 + j];
    data[i] = byte;
  }

  let padIdx = bits.length / 8;
  const pads = [0xec, 0x11];
  let toggle = 0;
  while (padIdx < totalDataCodewords) {
    data[padIdx++] = pads[toggle];
    toggle ^= 1;
  }

  const layout = BLOCK_LAYOUT[version];
  const dataBlocks: Uint8Array[] = [];
  const eccBlocks: Uint8Array[] = [];
  for (let b = 0; b < layout.blocks; b++) {
    const slice = data.slice(b * layout.dataPerBlock, (b + 1) * layout.dataPerBlock);
    dataBlocks.push(slice);
    eccBlocks.push(rsRemainder(slice, layout.eccPerBlock));
  }

  const out: number[] = [];
  for (let i = 0; i < layout.dataPerBlock; i++) {
    for (let b = 0; b < layout.blocks; b++) out.push(dataBlocks[b][i]);
  }
  for (let i = 0; i < layout.eccPerBlock; i++) {
    for (let b = 0; b < layout.blocks; b++) out.push(eccBlocks[b][i]);
  }
  return new Uint8Array(out);
}

function drawFinder(grid: number[][], fixed: boolean[][], r0: number, c0: number) {
  const n = grid.length;
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      const r = r0 + dr;
      const c = c0 + dc;
      if (r < 0 || r >= n || c < 0 || c >= n) continue;
      fixed[r][c] = true;
      const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
      const onBorder = dr === 0 || dr === 6 || dc === 0 || dc === 6;
      const inCenter = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
      grid[r][c] = inOuter && (onBorder || inCenter) ? 1 : 0;
    }
  }
}

function drawAlignment(grid: number[][], fixed: boolean[][], cr: number, cc: number) {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      const r = cr + dr;
      const c = cc + dc;
      fixed[r][c] = true;
      const dark = Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0);
      grid[r][c] = dark ? 1 : 0;
    }
  }
}

function formatBits(mask: number): number {
  // ECC Level L = 01 (bits 01 << 3 | mask)
  const data = (0b01 << 3) | mask;
  let rem = data << 10;
  const poly = 0x537;
  for (let i = 14; i >= 10; i--) {
    if (rem & (1 << i)) rem ^= poly << (i - 10);
  }
  return ((data << 10) | rem) ^ 0x5412;
}

function applyFormat(grid: number[][], mask: number) {
  const n = grid.length;
  const bits = formatBits(mask);
  const getBit = (i: number) => (bits >>> i) & 1;

  for (let i = 0; i <= 5; i++) grid[8][i] = getBit(14 - i);
  grid[8][7] = getBit(8);
  grid[8][8] = getBit(7);
  grid[7][8] = getBit(6);
  for (let i = 9; i <= 14; i++) grid[14 - i][8] = getBit(14 - i);

  for (let i = 0; i <= 6; i++) grid[n - 1 - i][8] = getBit(14 - i);
  for (let i = 7; i <= 14; i++) grid[8][n - 15 + i] = getBit(14 - i);
}

function maskCond(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function penaltyScore(grid: number[][]): number {
  const n = grid.length;
  let score = 0;
  for (let r = 0; r < n; r++) {
    let run = 1;
    for (let c = 1; c < n; c++) {
      if (grid[r][c] === grid[r][c - 1]) run++;
      else {
        if (run >= 5) score += run - 2;
        run = 1;
      }
    }
    if (run >= 5) score += run - 2;
  }
  for (let c = 0; c < n; c++) {
    let run = 1;
    for (let r = 1; r < n; r++) {
      if (grid[r][c] === grid[r - 1][c]) run++;
      else {
        if (run >= 5) score += run - 2;
        run = 1;
      }
    }
    if (run >= 5) score += run - 2;
  }
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = grid[r][c];
      if (grid[r][c + 1] === v && grid[r + 1][c] === v && grid[r + 1][c + 1] === v) {
        score += 3;
      }
    }
  }
  return score;
}

/** Generates a 2D boolean QR code matrix (dark = true) for any receipt or verification string. */
export function generateQrMatrix(text: string): boolean[][] {
  const payload = encodeBytes(text);
  const clipped = payload.length > 134 ? payload.slice(0, 134) : payload;
  const spec =
    VERSIONS.find((v) => clipped.length + 2 <= v.dataCodewords) ?? VERSIONS[VERSIONS.length - 1];
  const n = spec.size;
  const codewords = buildCodewords(clipped, spec.dataCodewords, spec.version);

  const baseGrid = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const fixed = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));

  drawFinder(baseGrid, fixed, 0, 0);
  drawFinder(baseGrid, fixed, 0, n - 7);
  drawFinder(baseGrid, fixed, n - 7, 0);

  for (let i = 8; i < n - 8; i++) {
    fixed[6][i] = true;
    fixed[i][6] = true;
    const bit = i % 2 === 0 ? 1 : 0;
    baseGrid[6][i] = bit;
    baseGrid[i][6] = bit;
  }

  if (spec.align.length >= 2) {
    for (const ar of spec.align) {
      for (const ac of spec.align) {
        if (fixed[ar][ac]) continue;
        drawAlignment(baseGrid, fixed, ar, ac);
      }
    }
  }

  // Reserve format info & dark module
  for (let i = 0; i <= 8; i++) {
    fixed[8][i] = true;
    fixed[i][8] = true;
  }
  for (let i = 0; i <= 7; i++) {
    fixed[n - 1 - i][8] = true;
    fixed[8][n - 1 - i] = true;
  }
  fixed[n - 8][8] = true;
  baseGrid[n - 8][8] = 1;

  // Place data bits in zig-zag columns
  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  let dir = -1;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let step = 0; step < n; step++) {
      const r = dir === -1 ? n - 1 - step : step;
      for (const dc of [0, -1]) {
        const c = col + dc;
        if (fixed[r][c]) continue;
        const bit =
          bitIdx < totalBits
            ? (codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1
            : 0;
        baseGrid[r][c] = bit;
        bitIdx++;
      }
    }
    dir *= -1;
  }

  let bestMask = 0;
  let bestScore = Infinity;
  let bestGrid = baseGrid;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = baseGrid.map((row, r) =>
      row.map((val, c) => (!fixed[r][c] && maskCond(mask, r, c) ? val ^ 1 : val))
    );
    applyFormat(candidate, mask);
    const score = penaltyScore(candidate);
    if (score < bestScore) {
      bestScore = score;
      bestMask = mask;
      bestGrid = candidate;
    }
  }

  applyFormat(bestGrid, bestMask);
  return bestGrid.map((row) => row.map((v) => v === 1));
}

/** Builds a compact crisp SVG string of the QR matrix with a quiet zone for HTML print/PDF. */
export function buildQrSvgMarkup(text: string, sizePx = 112): string {
  const matrix = generateQrMatrix(text);
  const n = matrix.length;
  const quiet = 2;
  const viewSize = n + quiet * 2;
  const rects: string[] = [];

  for (let r = 0; r < n; r++) {
    let runStart = -1;
    for (let c = 0; c <= n; c++) {
      const dark = c < n && matrix[r][c];
      if (dark && runStart === -1) {
        runStart = c;
      } else if (!dark && runStart !== -1) {
        rects.push(
          `<rect x="${runStart + quiet}" y="${r + quiet}" width="${c - runStart}" height="1"/>`
        );
        runStart = -1;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${viewSize} ${viewSize}" shape-rendering="crispEdges"><rect width="${viewSize}" height="${viewSize}" fill="#FFFFFF"/><g fill="#111317">${rects.join("")}</g></svg>`;
}
