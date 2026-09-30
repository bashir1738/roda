import { useCallback } from 'react';
import { BN } from '@anchor-lang/core';
import { SystemProgram } from '@solana/web3.js';
import { circlePda, memberPda } from '../lib/pdas';
import { useProgramAction } from './useProgramAction';

/** Join a circle by its 6-digit code (creates the membership PDA). */
export function useJoinCircle() {
  const action = useProgramAction();

  const joinCircle = useCallback(
    async (circleCode: number) => {
      return action.run(async (program, wallet) => {
        const owner = wallet.publicKey;
        const circle = circlePda(circleCode);
        return program.methods
          .joinCircle(new BN(circleCode))
          .accountsPartial({
            circle,
            memberAccount: memberPda(circle, owner),
            member: owner,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      });
    },
    [action]
  );

  return {
    joinCircle,
    txState: action.txState,
    txHash: action.txHash,
    error: action.error,
    isPending: action.isPending,
    isSuccess: action.txState === 'success',
    reset: action.reset,
  };
}
