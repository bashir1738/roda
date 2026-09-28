import { useCallback } from 'react';
import { SystemProgram } from '@solana/web3.js';
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { configPda, faucetAuthorityPda, faucetInfoPda, usdcAta } from '../lib/pdas';
import { MINT } from '../lib/token';
import { useProgramAction } from './useProgramAction';

/**
 * Claim 1,000 test USDC from the on-chain faucet (24h cooldown, enforced
 * by the program via FaucetInfo).
 */
export function useFaucet() {
  const action = useProgramAction();

  const claim = useCallback(
    async () => {
      return action.run(async (program, wallet) => {
        const user = wallet.publicKey;
        return program.methods
          .requestUsdc()
          .accountsPartial({
            config: configPda(),
            mint: MINT,
            faucetAuthority: faucetAuthorityPda(),
            faucetInfo: faucetInfoPda(user),
            userTokenAccount: usdcAta(user),
            user,
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
    claim,
    txState: action.txState,
    txHash: action.txHash,
    error: action.error,
    isPending: action.isPending,
    isSuccess: action.txState === 'success',
    reset: action.reset,
  };
}
