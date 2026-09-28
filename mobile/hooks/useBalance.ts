import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '../providers/WalletContext';
import { getConnection } from '../lib/connection';
import { usdcAta } from '../lib/pdas';

export interface Balances {
  /** SOL in lamports. */
  sol: bigint;
  /** USDC in 6-decimal raw units. */
  usdc: bigint;
}

/** Live SOL + USDC balances for the device wallet. */
export function useBalance() {
  const { address } = useWallet();

  const { data, isLoading, refetch } = useQuery<Balances>({
    queryKey: ['balance', address],
    enabled: !!address,
    refetchInterval: 20_000,
    queryFn: async () => {
      const connection = getConnection();
      const owner = new PublicKey(address!);
      const [sol, ata] = await Promise.all([
        connection.getBalance(owner).then((b) => BigInt(b)),
        Promise.resolve(usdcAta(owner)),
      ]);
      let usdc = 0n;
      try {
        const info = await connection.getAccountInfo(ata);
        if (info) {
          const res = await connection.getTokenAccountBalance(ata);
          usdc = BigInt(res.value.amount);
        }
      } catch {
        // ATA missing / RPC hiccup — treat as zero.
      }
      return { sol, usdc };
    },
  });

  return {
    sol: data?.sol ?? 0n,
    usdc: data?.usdc ?? 0n,
    isLoading,
    refetch,
  };
}
