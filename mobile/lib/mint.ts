import { PublicKey } from '@solana/web3.js';
import { USDC_MINT } from '../constants/roda';

/**
 * The mint every Roda instruction must use — `RodaConfig.usdc_mint` on chain.
 *
 * Seeded from the built-in constant so the app still works before the first
 * config fetch (and if that fetch fails); `syncUsdcMint` / `useUsdcMint` then
 * keep it aligned with whatever the admin has configured.
 */
let current: PublicKey = new PublicKey(USDC_MINT);

/** Current USDC mint (config-backed, with the constant as fallback). */
export function getUsdcMint(): PublicKey {
  return current;
}

/** Point the cached mint at a new value (string or PublicKey). */
export function setUsdcMint(mint: PublicKey | string): void {
  const next = typeof mint === 'string' ? new PublicKey(mint) : mint;
  if (!next.equals(current)) current = next;
}
