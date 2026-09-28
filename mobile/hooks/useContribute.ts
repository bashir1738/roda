import { useCallback } from 'react';
import { BN } from '@anchor-lang/core';
import { Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  configPda,
  circleAuthority,
  circleAta,
  circlePda,
  memberPda,
} from '../lib/pdas';
import { getConnection } from '../lib/connection';
import { ensureUsdcAtaIx, MINT } from '../lib/token';
import { useProgramAction } from './useProgramAction';

export interface ContributeParams {
  circleId: number;
  /** Raw 6-decimal USDC amount — must equal the circle's contribution. */
  amountIn: bigint;
}

/** Pay this round's contribution into a circle's treasury. */
export function useContribute() {
  const action = useProgramAction();

  const contribute = useCallback(
    async (params: ContributeParams) => {
      return action.run(async (program, wallet) => {
        const owner = wallet.publicKey;
        const connection = getConnection();
        const circle = circlePda(params.circleId);

        const { ata, ix } = await ensureUsdcAtaIx(connection, owner);
        const tx = new Transaction();
        if (ix) tx.add(ix);

        tx.add(
          await program.methods
            .contribute(new BN(params.amountIn.toString()))
            .accountsPartial({
              config: configPda(),
              circle,
              memberAccount: memberPda(circle, owner),
              circleAuthority: circleAuthority(circle),
              tokenMint: MINT,
              userTokenAccount: ata,
              circleTokenAccount: circleAta(circle),
              owner,
              tokenProgram: TOKEN_PROGRAM_ID,
            })
            .instruction()
        );

        return (program.provider as any).sendAndConfirm(tx, []);
      });
    },
    [action]
  );

  return {
    contribute,
    txState: action.txState,
    txHash: action.txHash,
    error: action.error,
    isPending: action.isPending,
    isSuccess: action.txState === 'success',
    reset: action.reset,
  };
}
