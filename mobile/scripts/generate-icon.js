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
 * Draw a white leaf centered on a purple field.
 * The leaf is a simple teardrop/leaf shape with a stem.
 */
function renderIcon(size, opts = {}) {
  const { transparentBg = false, bg = PURPLE, scale = 1 } = opts;
  const png = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;

  // Leaf geometry
  const leafW = size * 0.38 * scale;
  const leafH = size * 0.52 * scale;
  const leafTop = cy - leafH * 0.55;
  const leafBottom = leafTop + leafH;
  const stemWidth = size * 0.04 * scale;
  const stemHeight = size * 0.14 * scale;

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

      const dx = x - cx;

      // Stem (thin rectangle below leaf)
      const stemTop = leafBottom - leafH * 0.08;
      const stemBottom = stemTop + stemHeight;
      if (y >= stemTop && y <= stemBottom && Math.abs(dx) <= stemWidth / 2) {
        // Round the bottom of the stem
        const distFromBottom = (stemBottom - y) / stemHeight;
        if (distFromBottom >= 0 && distFromBottom <= 0.3) {
          const curve = 1 - (distFromBottom / 0.3);
          const maxX = (stemWidth / 2) * Math.sqrt(Math.max(0, 1 - curve * curve));
          if (Math.abs(dx) <= maxX) {
            color = WHITE;
            alpha = 255;
          }
        } else {
          color = WHITE;
          alpha = 255;
        }
      }

      // Leaf body (teardrop shape)
      if (y >= leafTop && y <= leafBottom) {
        const t = (y - leafTop) / leafH;
        // Width varies: narrow at top, widest at ~70%, then curves to point
        let widthFactor;
        if (t < 0.7) {
          // expanding part
          widthFactor = Math.sin((t / 0.7) * Math.PI * 0.5);
        } else {
          // tapering to point
          widthFactor = Math.cos(((t - 0.7) / 0.3) * Math.PI * 0.5);
        }
        const halfW = (leafW / 2) * widthFactor;

        if (Math.abs(dx) <= halfW) {
          color = WHITE;
          alpha = 255;
        }
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
