/**
 * Expo CLI (57.0.26) replaces `globalThis.URL` with `fetch-nodeshim`'s URL
 * class, which has no static `URL.canParse`. Metro's bundle-request parser
 * calls `URL.canParse(...)`, so every `/index.bundle` request dies with
 * `500 TypeError: URL.canParse is not a function` as soon as `expo start`
 * loads that module (i.e. once a dev client connects).
 *
 * Restore a WHATWG-compliant `canParse` on whatever class is installed.
 * Idempotent, safe to re-run (npm postinstall).
 */
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  '@expo',
  'cli',
  'build',
  'src',
  'utils',
  'fetch.js',
);

const MARK = '/* roda:restore-url-canparse */';

if (!fs.existsSync(target)) {
  console.log('[patch-expo-fetch] @expo/cli fetch.js not found, skipping');
  process.exit(0);
}

const src = fs.readFileSync(target, 'utf8');
if (src.includes(MARK)) {
  process.exit(0);
}

const anchor = '});\n\n//# sourceMappingURL=fetch.js.map';
const patch = `});

${MARK}
if (typeof globalThis.URL.canParse !== 'function') {
  const { URL: NodeURL } = require('node:url');
  globalThis.URL.canParse = (input, base) => {
    try { new NodeURL(input, base); return true; } catch { return false; }
  };
}

//# sourceMappingURL=fetch.js.map`;

if (!src.includes(anchor)) {
  console.error('[patch-expo-fetch] anchor not found — @expo/cli layout changed; skipping');
  process.exit(0);
}

fs.writeFileSync(target, src.replace(anchor, patch));
console.log('[patch-expo-fetch] patched', target);
