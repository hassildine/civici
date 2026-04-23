/**
 * Removes dark background connected to image edges (flood fill), then trims.
 * Better than a flat RGB threshold when the export is black / dark gray.
 *
 * Run from civici-app: node scripts/key-black-transparent.cjs
 */
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const input = path.join(__dirname, "..", "public", "civici-logo.png");
const tmp = input + ".tmp.png";

/** True for pixels that look like background (not the blue wordmark). */
function isBackgroundLike(r, g, b) {
  if (r > 78 || g > 78 || b > 78) return false;
  const avg = (r + g + b) / 3;
  if (avg > 58) return false;
  // Keep saturated blues even if one channel is low (e.g. #1665AD).
  if (b >= r + 40 && b >= g + 20 && avg > 35) return false;
  return true;
}

(async () => {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const stride = 4;
  const idx = (x, y) => (y * w + x) * stride;

  const visited = new Uint8Array(w * h);
  const queue = [];

  const push = (x, y) => {
    const i = y * w + x;
    if (visited[i]) return;
    const p = idx(x, y);
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const a = data[p + 3];
    if (a < 8) {
      visited[i] = 1;
      return;
    }
    if (!isBackgroundLike(r, g, b)) return;
    visited[i] = 1;
    queue.push(x, y);
  };

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }

  for (let qi = 0; qi < queue.length; qi += 2) {
    const x = queue[qi];
    const y = queue[qi + 1];
    const p = idx(x, y);
    data[p + 3] = 0;
    data[p] = 0;
    data[p + 1] = 0;
    data[p + 2] = 0;

    const neigh = [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ];
    for (const [nx, ny] of neigh) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (visited[ni]) continue;
      const np = idx(nx, ny);
      const r = data[np];
      const g = data[np + 1];
      const b = data[np + 2];
      const a = data[np + 3];
      if (a < 8) {
        visited[ni] = 1;
        continue;
      }
      if (!isBackgroundLike(r, g, b)) continue;
      visited[ni] = 1;
      queue.push(nx, ny);
    }
  }

  await sharp(data, {
    raw: { width: w, height: h, channels: 4 },
  })
    .trim()
    .png({ compressionLevel: 9 })
    .toFile(tmp);
  fs.renameSync(tmp, input);
  const meta = await sharp(input).metadata();
  console.log(`Updated ${path.basename(input)} → ${meta.width}×${meta.height} (edge flood + trim).`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
