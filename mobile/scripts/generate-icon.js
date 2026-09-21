// Generates Roda brand icons (app icon, adaptive icon, splash, favicon) as PNGs
// using pngjs (no native deps). Run: node scripts/generate-icon.js
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// Brand colors
const PURPLE = [66, 31, 109];   // #421F6D
const WHITE = [255, 255, 255];  // #FFFFFF

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/**
 * Check if point (px, py) is inside an SVG path using ray casting.
 * Path is scaled and translated to fit within the icon bounds.
 */
function pointInSvgPath(px, py, pathData, scale, offsetX, offsetY) {
  // Simple ray casting for SVG paths
  let inside = false;
  const commands = pathData.match(/[MLCQZ][^MLCQZ]*/gi);
  if (!commands) return false;

  let curX = 0, curY = 0;
  let startX = 0, startY = 0;

  for (const cmd of commands) {
    const type = cmd[0];
    const nums = cmd.slice(1).trim().split(/[\s,]+/).map(Number);

    switch (type.toUpperCase()) {
      case 'M':
        curX = nums[0] * scale + offsetX;
        curY = nums[1] * scale + offsetY;
        startX = curX;
        startY = curY;
        break;
      case 'L':
        for (let i = 0; i < nums.length; i += 2) {
          const x1 = curX, y1 = curY;
          const x2 = nums[i] * scale + offsetX;
          const y2 = nums[i + 1] * scale + offsetY;
          if (((y1 > py) !== (y2 > py)) && (px < (x2 - x1) * (py - y1) / (y2 - y1) + x1)) {
            inside = !inside;
          }
          curX = x2;
          curY = y2;
        }
        break;
      case 'C':
        for (let i = 0; i < nums.length; i += 6) {
          const x1 = curX, y1 = curY;
          const cx1 = nums[i] * scale + offsetX;
          const cy1 = nums[i + 1] * scale + offsetY;
          const cx2 = nums[i + 2] * scale + offsetX;
          const cy2 = nums[i + 3] * scale + offsetY;
          const x2 = nums[i + 4] * scale + offsetX;
          const y2 = nums[i + 5] * scale + offsetY;

          // Approximate cubic bezier with line segments
          const steps = 8;
          let prevX = x1, prevY = y1;
          for (let t = 1; t <= steps; t++) {
            const tt = t / steps;
            const t2 = tt * tt;
            const t3 = t2 * tt;
            const mt = 1 - tt;
            const mt2 = mt * mt;
            const mt3 = mt2 * mt;
            const nextX = mt3 * x1 + 3 * mt2 * tt * cx1 + 3 * mt * t2 * cx2 + t3 * x2;
            const nextY = mt3 * y1 + 3 * mt2 * tt * cy1 + 3 * mt * t2 * cy2 + t3 * y2;

            if (((prevY > py) !== (nextY > py)) && (px < (nextX - prevX) * (py - prevY) / (nextY - prevY) + prevX)) {
              inside = !inside;
            }
            prevX = nextX;
            prevY = nextY;
          }
          curX = x2;
          curY = y2;
        }
        break;
      case 'Z':
        if (curX !== startX || curY !== startY) {
          if (((curY > py) !== (startY > py)) && (px < (startX - curX) * (py - curY) / (startY - curY) + curX)) {
            inside = !inside;
          }
          curX = startX;
          curY = startY;
        }
        break;
    }
  }
  return inside;
}

// The exact leaf SVG paths from frontend/app/icon.svg, scaled to 512x512 viewBox
const LEAF_PATH1 = "M161.35,242a16,16,0,0,1,22.62-.68c73.63,69.36,147.51,111.56,234.45,133.07,11.73-32,12.77-67.22,2.64-101.58-13.44-45.59-44.74-85.31-90.49-114.86-40.84-26.38-81.66-33.25-121.15-39.89-49.82-8.38-96.88-16.3-141.79-63.85-5-5.26-11.81-7.37-18.32-5.66-7.44,2-12.43,7.88-14.82,17.6-5.6,22.75-2,86.51,13.75,153.82,25.29,108.14,65.65,162.86,95.06,189.73,38,34.69,87.62,53.9,136.93,53.9A186,186,0,0,0,308,461.56c41.71-6.32,76.43-27.27,96-57.75-89.49-23.28-165.94-67.55-242-139.16A16,16,0,0,1,161.35,242Z";
const LEAF_PATH2 = "M467.43,384.19c-16.83-2.59-33.13-5.84-49-9.77a157.71,157.71,0,0,1-12.13,25.68c-.73,1.25-1.5,2.49-2.29,3.71a584.21,584.21,0,0,0,58.56,12,16,16,0,1,0,4.87-31.62Z";

/**
 * Draw the Roda leaf icon: white leaf on purple background.
 * Uses the exact SVG paths from the frontend.
 */
function renderIcon(size, opts = {}) {
  const { transparentBg = false, bg = PURPLE, scale = 1 } = opts;
  const png = new PNG({ width: size, height: size });

  // The SVG viewBox is 0 0 512 512, with the leaf group translated by (46,46) and scaled by 0.82
  const svgScale = 0.82 * scale;
  const svgOffsetX = 46 * scale;
  const svgOffsetY = 46 * scale;
  const svgSize = 512;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      let color = null;
      let alpha = 255;

      // Background
      if (transparentBg) {
        alpha = 0;
      } else {
        color = bg;
        alpha = 255;
      }

      // Map pixel to SVG coordinates
      const svgX = (x / size) * svgSize;
      const svgY = (y / size) * svgSize;

      // Check if point is inside either leaf path
      const inLeaf1 = pointInSvgPath(svgX, svgY, LEAF_PATH1, svgScale, svgOffsetX, svgOffsetY);
      const inLeaf2 = pointInSvgPath(svgX, svgY, LEAF_PATH2, svgScale, svgOffsetX, svgOffsetY);

      if (inLeaf1 || inLeaf2) {
        color = WHITE;
        alpha = 255;
      }

      if (color === null) {
        if (transparentBg) {
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 0;
          continue;
        }
        color = bg;
      }

      png.data[idx] = color[0];
      png.data[idx + 1] = color[1];
      png.data[idx + 2] = color[2];
      png.data[idx + 3] = alpha;
    }
  }
  return png;
}

function save(png, file) {
  const out = path.resolve(__dirname, '../assets/images', file);
  fs.writeFileSync(out, PNG.sync.write(png));
  console.log('wrote', file);
}

// App icon (1024) — full purple bg
save(renderIcon(1024, { transparentBg: false }), 'icon.png');
// Adaptive icon foreground (1024) — transparent bg, larger safe-area scale
save(renderIcon(1024, { transparentBg: true, scale: 0.78 }), 'adaptive-icon.png');
// Splash (1024) — purple bg, smaller mark
save(renderIcon(1024, { transparentBg: true, scale: 0.9 }), 'splash-icon.png');
// Favicon (48)
save(renderIcon(48, { transparentBg: false }), 'favicon.png');

console.log('Done generating Roda icons.');
