// Custom entry point. Polyfills MUST run before expo-router/entry so that
// globalThis.crypto.getRandomValues exists before any module (notably
// @noble/hashes, used by the Solana libs) captures it at load time.
require('./polyfills');
require('expo-router/entry');
