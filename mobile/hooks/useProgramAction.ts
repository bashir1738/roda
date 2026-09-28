import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getProgram, type AnyProgram } from '../lib/program';
import { friendlyError } from '../lib/sendTx';
import type { SolanaWallet } from '../lib/wallet';
import { useWallet, type TxState } from '../providers/WalletContext';

export interface ProgramAction {
  txState: TxState;
  txHash: string | null;
  error: string | null;
  isPending: boolean;
  reset: () => void;
  /**
   * Build + send a transaction with the connected wallet.
   * `build` should return the transaction signature (already confirmed).
   */
  run: (build: (program: AnyProgram, wallet: SolanaWallet) => Promise<string>) => Promise<string | null>;
}

/**
 * Shared transaction runner: state machine, friendly errors, and query
 * invalidation after any successful write.
 */
export function useProgramAction(): ProgramAction {
  const { wallet } = useWallet();
  const queryClient = useQueryClient();
  const [txState, setTxState] = useState<TxState>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setTxState('idle');
    setTxHash(null);
    setError(null);
  }, []);

  const run = useCallback(
    async (build: (program: AnyProgram, wallet: SolanaWallet) => Promise<string>) => {
      if (!wallet) {
        setError('Connect a wallet first.');
        setTxState('error');
        return null;
      }
      setTxState('signing');
      setError(null);
      setTxHash(null);
      try {
        const program = getProgram(wallet);
        const signature = await build(program, wallet);
        setTxHash(signature);
        setTxState('success');
        queryClient.invalidateQueries();
        return signature;
      } catch (e) {
        if (__DEV__) console.warn('[tx]', e);
        setError(friendlyError(e));
        setTxState('error');
        return null;
      }
    },
    [wallet, queryClient]
  );

  return {
    txState,
    txHash,
    error,
    isPending: txState === 'signing',
    reset,
    run,
  };
}
