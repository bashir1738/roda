import { useQuery } from '@tanstack/react-query';
import { useWallet } from '../providers/WalletContext';
import { getProgram } from '../lib/program';
import { VAULT_OWNER_OFFSET } from '../lib/pdas';
import { toNumber, variantIndex } from '../lib/decode';
import { VAULT_TIERS as TIER_INFOS } from '../constants/roda';

export type VaultTier = 'Flex' | 'Weekly' | 'Monthly' | '6 Months' | '1 Year';

const TIER_LABELS: VaultTier[] = ['Flex', 'Weekly', 'Monthly', '6 Months', '1 Year'];
const TIER_ICONS: string[] = ['water-outline', 'leaf-outline', 'flash-outline', 'calendar-outline', 'trophy-outline'];

export interface TierMeta {
  tier: 0 | 1 | 2 | 3 | 4;
  key: 'flex' | 'weekly' | 'monthly';
  label: VaultTier;
  name: string;
  /** Minimum deposit in whole USDC. */
  minUSDC: number;
  /** Lock duration in days (0 = no lock). */
  lockDays: number;
  icon: string;
  description: string;
}

/** Tier metadata keyed by display name: VAULT_TIERS.Flex, VAULT_TIERS.Weekly… */
export const VAULT_TIERS = Object.fromEntries(
  TIER_INFOS.map((t, i) => [
    TIER_LABELS[i],
    {
      tier: t.tier,
      key: t.key,
      label: TIER_LABELS[i],
      name: t.name,
      minUSDC: t.minUsdc,
      lockDays: t.lockDays,
      icon: TIER_ICONS[i],
      description: t.description,
    },
  ])
) as Record<VaultTier, TierMeta>;

export const TIER_KEYS: VaultTier[] = TIER_LABELS;
export const tierKeyFor = (tier: number): VaultTier => TIER_LABELS[tier] ?? 'Flex';

export interface VaultData {
  /** Vault PDA address. */
  address: string;
  id: number;
  owner: string;
  tier: 0 | 1 | 2 | 3 | 4;
  tierKey: VaultTier;
  /** Raw balance in 6-decimal units. */
  balance: bigint;
  principalUSDC: bigint;
  currentBalanceUSDC: bigint;
  depositTimestamp: number;
  maturityTimestamp: number;
  /** Tier lock duration in seconds. */
  lockDuration: number;
  isMatured: boolean;
  active: boolean;
}

/**
 * The connected wallet's on-chain vaults (UserVault PDAs). Empty when
 * disconnected or when no vaults exist. Empty-balance vaults are hidden.
 */
export function useVaults() {
  const { address } = useWallet();

  const { data, isLoading } = useQuery<VaultData[]>({
    queryKey: ['vaults', address],
    enabled: !!address,
    refetchInterval: 60_000,
    queryFn: async () => {
      const program = getProgram();
      const accounts = await program.account.userVault.all([
        { memcmp: { offset: VAULT_OWNER_OFFSET, bytes: address! } },
      ]);
      const now = Math.floor(Date.now() / 1000);
      const out: VaultData[] = [];
      for (const acc of accounts) {
        const v: any = acc.account;
        const tier = variantIndex(v.tier, ['flex', 'weekly', 'monthly', 'sixMonths', 'oneYear']) as 0 | 1 | 2 | 3 | 4;
        const meta = VAULT_TIERS[tierKeyFor(tier)];
        const balance = BigInt(v.balance?.toString?.() ?? 0);
        if (!v.active || balance === 0n) continue;
        const maturity = toNumber(v.maturityTs);
        const depositTs = toNumber(v.lastDepositTs);
        out.push({
          address: acc.publicKey.toBase58(),
          id: toNumber(v.vaultId),
          owner: v.owner.toBase58(),
          tier,
          tierKey: meta.label,
          balance,
          principalUSDC: balance,
          currentBalanceUSDC: balance,
          depositTimestamp: depositTs,
          maturityTimestamp: maturity,
          lockDuration: meta.lockDays * 86_400,
          isMatured: meta.lockDays === 0 || (maturity > 0 && now >= maturity),
          active: true,
        });
      }
      out.sort((a, b) => a.id - b.id);
      return out;
    },
  });

  return { vaults: data ?? [], isLoading };
}
