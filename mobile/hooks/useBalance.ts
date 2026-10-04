import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '../providers/WalletContext';
import { getConnection } from '../lib/connection';
import { tokenAta, usdcAta } from '../lib/pdas';
import { SKR_DECIMALS, SKR_MINT } from '../constants/roda';
import { useUsdcMint } from './useUsdcMint';

export interface Balances {
  /** SOL in lamports. */
  sol: bigint;
  /** USDC in 6-decimal raw units. */
  usdc: bigint;
  /** SKR in 6-decimal raw units. */
  skr: bigint;
}

/** Live SOL, USDC, and SKR balances for the connected wallet. */
export function useBalance() {
  const { address } = useWallet();
  const mint = useUsdcMint();

  const { data, isLoading, refetch } = useQuery<Balances>({
    queryKey: ['balance', address, mint.toBase58()],
    enabled: !!address,
    refetchInterval: 30_000,
    queryFn: async () => {
      const connection = getConnection();
      const owner = new PublicKey(address!);
      const [sol, ata, skrAta] = await Promise.all([
        connection.getBalance(owner).then((b) => BigInt(b)),
        Promise.resolve(usdcAta(owner)),
        Promise.resolve(tokenAta(SKR_MINT, owner)),
      ]);
      const readTokenBalance = async (tokenAta: typeof ata): Promise<bigint> => {
        try {
          const info = await connection.getAccountInfo(tokenAta);
          if (!info) return 0n;
          const res = await connection.getTokenAccountBalance(tokenAta);
          return BigInt(res.value.amount);
        } catch {
          return 0n;
        }
      };
      const [usdc, skr] = await Promise.all([
        readTokenBalance(ata),
        readTokenBalance(skrAta),
      ]);
      return { sol, usdc, skr };
    },
  });

  return {
    sol: data?.sol ?? 0n,
    usdc: data?.usdc ?? 0n,
    skr: data?.skr ?? 0n,
    isLoading,
    refetch,
  };
}
