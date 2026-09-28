import { useCallback } from 'react';
import { BN } from '@anchor-lang/core';
import { SystemProgram } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  configPda,
  circleAuthority,
  circleAta,
  circlePda,
  memberPda,
} from '../lib/pdas';
import { MINT } from '../lib/token';
import { toNumber } from '../lib/decode';
import { usdcToRaw } from '../constants/roda';
import { useProgramAction } from './useProgramAction';

export interface CreateCircleParams {
  name: string;
  maxMembers: number;
  /** Whole USDC (e.g. 25) — converted to 6-decimals internally. */
  contributionUSDC: number;
  /** Seconds between rounds (program minimum: 60). */
  frequencySeconds: number;
}

/** Create a circle; the caller is member #1. */
export function useCreateCircle() {
  const action = useProgramAction();

  const createCircle = useCallback(
    async (params: CreateCircleParams) => {
      return action.run(async (program, wallet) => {
        const owner = wallet.publicKey;
        const config: any = await program.account.rodaConfig.fetch(configPda());
        const circleId = toNumber(config.circleCount);
        const circle = circlePda(circleId);

        return program.methods
          .createCircle(
            params.name.trim(),
            params.maxMembers,
            new BN(usdcToRaw(params.contributionUSDC)),
            new BN(params.frequencySeconds)
          )
          .accountsPartial({
            config: configPda(),
            circle,
            creatorMember: memberPda(circle, owner),
            circleAuthority: circleAuthority(circle),
            tokenMint: MINT,
            circleTokenAccount: circleAta(circle),
            creator: owner,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
      });
    },
    [action]
  );

  return {
    createCircle,
    txState: action.txState,
    txHash: action.txHash,
    error: action.error,
    isPending: action.isPending,
    isSuccess: action.txState === 'success',
    reset: action.reset,
  };
}
