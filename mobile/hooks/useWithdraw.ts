import { useCallback } from 'react';
import { BN } from '@anchor-lang/core';
import { PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { configPda, vaultAuthority, vaultAta } from '../lib/pdas';
import { getConnection } from '../lib/connection';
import { ensureUsdcAtaIx, MINT } from '../lib/token';
import { useProgramAction } from './useProgramAction';

export interface WithdrawParams {
  /** Vault PDA address. */
  address: string;
  /** Raw amount; defaults to the vault's full balance. */
  amount?: bigint;
}

/**
 * Withdraw USDC from a vault to the owner's wallet. Defaults to a full
 * withdrawal when amount is omitted. Locked tiers enforce maturity on-chain.
 */
export function useWithdraw() {
  const action = useProgramAction();

  const withdraw = useCallback(
    async (params: WithdrawParams) => {
      return action.run(async (program, wallet) => {
        const owner = wallet.publicKey;
        const connection = getConnection();
        const vaultAddress = new PublicKey(params.address);

        const vault: any = await program.account.userVault.fetch(vaultAddress);
        const amount = params.amount ?? BigInt(vault.balance?.toString?.() ?? 0);
        if (amount <= 0n) throw new Error('Nothing to withdraw.');

        const { ata, ix } = await ensureUsdcAtaIx(connection, owner);
        const tx = new Transaction();
        if (ix) tx.add(ix);

        tx.add(
          await program.methods
            .withdraw(new BN(amount.toString()))
            .accountsPartial({
              config: configPda(),
              vault: vaultAddress,
              vaultAuthority: vaultAuthority(vaultAddress),
              tokenMint: MINT,
              userTokenAccount: ata,
              vaultTokenAccount: vaultAta(vaultAddress),
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
    withdraw,
    txState: action.txState,
    txHash: action.txHash,
    error: action.error,
    isPending: action.isPending,
    isSuccess: action.txState === 'success',
    reset: action.reset,
  };
}
