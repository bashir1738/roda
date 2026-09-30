import { useCallback, useState } from 'react';
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
import { getUsdcMint } from '../lib/mint';
import { usdcToRaw } from '../constants/roda';
import { isCodeCollision, randomCircleCode } from '../lib/circleCode';
import { useProgramAction } from './useProgramAction';

export interface CreateCircleParams {
  name: string;
  maxMembers: number;
  /** Whole USDC (e.g. 25) — converted to 6-decimals internally. */
  contributionUSDC: number;
  /** Seconds between rounds (program minimum: 60). */
  frequencySeconds: number;
}

/** How many random codes to try before giving up (collisions are ~1 in 900k). */
const MAX_CODE_ATTEMPTS = 5;

/** Create a circle; the caller is member #1. */
export function useCreateCircle() {
  const action = useProgramAction();
  const [createdCode, setCreatedCode] = useState<number | null>(null);

  const createCircle = useCallback(
    async (params: CreateCircleParams) => {
      setCreatedCode(null);
      return action.run(async (program, wallet) => {
        const owner = wallet.publicKey;
        let lastError: unknown = null;

        for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
          const code = randomCircleCode();
          const circle = circlePda(code);
          const existing = await program.account.circle
            .fetchNullable(circle)
            .catch(() => null);
          if (existing) continue;

          try {
            const signature = await program.methods
              .createCircle(
                new BN(code),
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
                tokenMint: getUsdcMint(),
                circleTokenAccount: circleAta(circle),
                creator: owner,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
              })
              .rpc();
            setCreatedCode(code);
            return signature;
          } catch (e) {
            lastError = e;
            if (!isCodeCollision(e)) throw e;
          }
        }

        throw lastError ?? new Error('No free circle code found — please try again.');
      });
    },
    [action]
  );

  const reset = useCallback(() => {
    setCreatedCode(null);
    action.reset();
  }, [action]);

  return {
    createCircle,
    createdCode,
    txState: action.txState,
    txHash: action.txHash,
    error: action.error,
    isPending: action.isPending,
    isSuccess: action.txState === 'success',
    reset,
  };
}
