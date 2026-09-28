import { useEffect, useState, useRef } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '../lib/connection';
import { MIN_SOL_LAMPORTS } from '../constants/roda';

const AIRDROP_LAMPORTS = 1_000_000_000; // 1 SOL on devnet

/**
 * Auto-funds the wallet with SOL for fees when its balance drops below the
 * minimum (devnet faucet). One attempt per mount.
 */
export function useFundWallet(address: string | undefined) {
  const [isFunding, setIsFunding] = useState(false);
  const [fundingError, setFundingError] = useState<string | null>(null);
  const fundingRef = useRef(false);

  useEffect(() => {
    if (!address || fundingRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const connection = getConnection();
        const owner = new PublicKey(address);
        const lamports = await connection.getBalance(owner);
        if (lamports >= MIN_SOL_LAMPORTS || cancelled) return;

        fundingRef.current = true;
        setIsFunding(true);
        setFundingError(null);

        const signature = await connection.requestAirdrop(owner, AIRDROP_LAMPORTS);
        await connection.confirmTransaction(signature, 'confirmed');
      } catch (err: any) {
        if (!cancelled) {
          setFundingError(
            err?.message?.includes('429') || err?.message?.includes('too many')
              ? 'SOL faucet is busy — try again in a minute.'
              : 'Could not claim SOL from the faucet.'
          );
        }
      } finally {
        if (!cancelled) setIsFunding(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address]);

  return { isFunding, fundingError };
}
