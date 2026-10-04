import { PublicKey } from '@solana/web3.js';

// ─── Cluster ──────────────────────────────────────────────────────────────────

export const CLUSTER = 'devnet' as const;

export const RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

export const EXPLORER_URL = 'https://explorer.solana.com';

export const explorerTx = (signature: string) =>
  `${EXPLORER_URL}/tx/${signature}?cluster=${CLUSTER}`;

export const explorerAddress = (address: string) =>
  `${EXPLORER_URL}/address/${address}?cluster=${CLUSTER}`;

// ─── Onchain addresses ────────────────────────────────────────────────────────

export const PROGRAM_ID = '5gA8XF9AuVoYkSAjMvqk7xpDDaV4Au5HGQwcEcyM9UXJ';

/**
 * Fallback USDC mint (Circle devnet USDC, 6 decimals). Only used before
 * `RodaConfig.usdc_mint` is fetched — see lib/mint.ts and hooks/useUsdcMint.ts.
 */
export const USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

export const USDC_DECIMALS = 6;

export const USDC_FACTOR = 10 ** USDC_DECIMALS;

export const SKR_MINT = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';
export const SKR_DECIMALS = 6;

/** Lamports needed before the app is usable (fees). */
export const MIN_SOL_LAMPORTS = 5_000_000; // 0.005 SOL

/** USDC available per faucet claim. */
export const FAUCET_AMOUNT_USDC = 1_000;

// ─── Vault tiers (mirrors program state.rs) ───────────────────────────────────

export interface VaultTierInfo {
  /** Onchain VaultTier discriminant (0-4). */
  tier: 0 | 1 | 2 | 3 | 4;
  key: 'flex' | 'weekly' | 'monthly' | 'sixMonths' | 'oneYear';
  name: string;
  /** Minimum deposit in whole USDC (0 = any amount). */
  minUsdc: number;
  /** Lock duration in days (0 = no lock). */
  lockDays: number;
  description: string;
}

export const VAULT_TIERS: VaultTierInfo[] = [
  {
    tier: 0,
    key: 'flex',
    name: 'Flex Solo',
    minUsdc: 0,
    lockDays: 0,
    description: 'Save at your own pace. Add funds whenever you have extra cash. Withdraw anytime.',
  },
  {
    tier: 1,
    key: 'weekly',
    name: 'Weekly Solo',
    minUsdc: 10,
    lockDays: 7,
    description: 'Build consistency. Lock in a weekly amount to slowly build your personal pot.',
  },
  {
    tier: 2,
    key: 'monthly',
    name: 'Monthly Solo',
    minUsdc: 50,
    lockDays: 30,
    description: 'Pay yourself first. Set aside a fixed chunk of your paycheck every month.',
  },
  {
    tier: 3,
    key: 'sixMonths',
    name: '6-Month Solo',
    minUsdc: 100,
    lockDays: 182,
    description: 'Build a stronger cushion with a six-month commitment.',
  },
  {
    tier: 4,
    key: 'oneYear',
    name: '1-Year Solo',
    minUsdc: 250,
    lockDays: 365,
    description: 'Commit for the long term and grow your savings over a full year.',
  },
];

export const tierInfo = (tier: number): VaultTierInfo =>
  VAULT_TIERS.find((t) => t.tier === tier) ?? VAULT_TIERS[0];

// ─── Circle frequency presets (seconds) ───────────────────────────────────────

export const FREQUENCY_PRESETS = [
  { label: '10 minutes', seconds: 600 },
  { label: 'Weekly', seconds: 7 * 24 * 60 * 60 },
  { label: 'Bi-weekly', seconds: 14 * 24 * 60 * 60 },
  { label: 'Monthly', seconds: 30 * 24 * 60 * 60 },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Truncate a base58 address for display: 8gSe4…qF9S */
export const shortAddress = (address?: string | null, head = 4, tail = 4) =>
  address ? `${address.slice(0, head)}…${address.slice(-tail)}` : '';

/** Format a USDC amount (raw 6-decimal units) for display. */
export const formatUsdc = (raw: number | bigint) => {
  const n = Number(raw) / USDC_FACTOR;
  return n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
};

export const usdcToRaw = (amount: number) => Math.round(amount * USDC_FACTOR);

export const isValidAddress = (value: string) => {
  try {
    const key = new PublicKey(value);
    return PublicKey.isOnCurve(key.toBytes()) || true; // PDAs are valid addresses too
  } catch {
    return false;
  }
};
