import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { getProgram, type AnyProgram } from '../lib/program';
import { configPda } from '../lib/pdas';
import { getUsdcMint, setUsdcMint } from '../lib/mint';

/**
 * Read `RodaConfig.usdc_mint` and update the cached mint.
 * Falls back to the cached value when the fetch fails, so a flaky RPC never
 * blocks a transaction.
 */
export async function syncUsdcMint(program: AnyProgram = getProgram()): Promise<PublicKey> {
  try {
    const config: any = await program.account.rodaConfig.fetch(configPda());
    if (config?.usdcMint) setUsdcMint(config.usdcMint);
  } catch {
    // Keep whatever the cache already holds.
  }
  return getUsdcMint();
}

/**
 * The USDC mint the program is currently configured to use. Refreshed every
 * minute so a mint change on chain reaches balance/asset screens too.
 */
export function useUsdcMint(): PublicKey {
  const { data } = useQuery<PublicKey>({
    queryKey: ['usdcMint'],
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: () => syncUsdcMint(),
  });
  return data ?? getUsdcMint();
}
