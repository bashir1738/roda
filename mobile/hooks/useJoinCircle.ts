import { useCallback } from 'react';
import { BN } from '@anchor-lang/core';
import { SystemProgram } from '@solana/web3.js';
import { circlePda, memberPda } from '../lib/pdas';
import { useProgramAction } from './useProgramAction';

/** Join a circle by its numeric id (creates the membership PDA). */
export function useJoinCircle() {
  const action = useProgramAction();

  const joinCircle = useCallback(
    async (circleId: number) => {
      return action.run(async (program, wallet) => {
        const owner = wallet.publicKey;
        const circle = circlePda(circleId);
        return program.methods
          .joinCircle(new BN(circleId))
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
