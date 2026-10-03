import { useCallback } from 'react';
import { BN } from '@anchor-lang/core';
import { SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import {
  configPda,
  vaultAuthority,
  vaultAta,
  vaultPda,
} from '../lib/pdas';
import { getConnection } from '../lib/connection';
import { ensureUsdcAtaIx } from '../lib/token';
import { getUsdcMint } from '../lib/mint';
import { toNumber, variantIndex } from '../lib/decode';
import { useProgramAction } from './useProgramAction';

export interface DepositParams {
  tier: 0 | 1 | 2 | 3 | 4;
  /** Raw 6-decimal USDC amount. */
  amountIn: bigint;
}

/**
 * Deposit USDC into a vault tier. Creates the tier's vault (and my USDC ATA)
 * when they don't exist yet — all in a single transaction.
 */
export function useDeposit() {
  const action = useProgramAction();

  const deposit = useCallback(
    async (params: DepositParams) => {
      return action.run(async (program, wallet) => {
        const owner = wallet.publicKey;
        const connection = getConnection();
        const tierVariant = (['flex', 'weekly', 'monthly', 'sixMonths', 'oneYear'] as const)[params.tier];

        // Reuse an existing active vault for this tier, else create one.
        const existing = await program.account.userVault.all([
          { memcmp: { offset: 8, bytes: owner.toBase58() } },
        ]);
        const match = existing.find(
          (v: any) =>
            v.account.active &&
            variantIndex(v.account.tier, ['flex', 'weekly', 'monthly', 'sixMonths', 'oneYear']) === params.tier
        );

        const tx = new Transaction();
        let vaultAddress;
        if (match) {
          vaultAddress = match.publicKey;
        } else {
          const config: any = await program.account.rodaConfig.fetch(configPda());
          const nextId = toNumber(config.vaultCount);
          vaultAddress = vaultPda(owner, nextId);
          tx.add(
            await program.methods
              .createVault({ [tierVariant]: {} })
              .accountsPartial({
                config: configPda(),
                vault: vaultAddress,
                tokenMint: getUsdcMint(),
                vaultAuthority: vaultAuthority(vaultAddress),
                vaultTokenAccount: vaultAta(vaultAddress),
                owner,
                tokenProgram: TOKEN_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
                rent: SYSVAR_RENT_PUBKEY,
              })
              .instruction()
          );
        }

        const { ata, ix } = await ensureUsdcAtaIx(connection, owner);
        if (ix) tx.add(ix);

        tx.add(
          await program.methods
            .deposit(new BN(params.amountIn.toString()))
            .accountsPartial({
              config: configPda(),
              vault: vaultAddress,
              vaultAuthority: vaultAuthority(vaultAddress),
              tokenMint: getUsdcMint(),
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
    deposit,
    txState: action.txState,
    txHash: action.txHash,
    error: action.error,
    isPending: action.isPending,
    isSuccess: action.txState === 'success',
    reset: action.reset,
  };
}
