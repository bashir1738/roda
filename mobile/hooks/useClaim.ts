import { useCallback } from 'react';
import { BN } from '@anchor-lang/core';
import { PublicKey, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { configPda, circleAuthority, circleAta, circlePda, vaultAuthority, vaultAta } from '../lib/pdas';
import { getConnection } from '../lib/connection';
import { ensureUsdcAtaIx } from '../lib/token';
import { getUsdcMint } from '../lib/mint';
import { toNumber } from '../lib/decode';
import { useProgramAction } from './useProgramAction';

type ClaimParams =
  | { type: 'circle'; circleId: number; [k: string]: unknown }
  | { type: 'vault'; vaultId: number; [k: string]: unknown };

/**
 * Claim a circle payout (to this round's recipient) or withdraw a matured
 * vault in full. Extra legacy fields on the params are ignored.
 */
export function useClaim() {
  const action = useProgramAction();

  const claim = useCallback(
    async (params: ClaimParams) => {
      return action.run(async (program, wallet) => {
        const owner = wallet.publicKey;
        const connection = getConnection();

        if (params.type === 'circle') {
          const circle = circlePda((params as any).circleId);
          const { ata, ix } = await ensureUsdcAtaIx(connection, owner);
          const tx = new Transaction();
          if (ix) tx.add(ix);
          tx.add(
            await program.methods
              .claimPayout()
              .accountsPartial({
                config: configPda(),
                circle,
                circleAuthority: circleAuthority(circle),
                tokenMint: getUsdcMint(),
                recipientTokenAccount: ata,
                circleTokenAccount: circleAta(circle),
                recipient: owner,
                tokenProgram: TOKEN_PROGRAM_ID,
              })
              .instruction()
          );
          return (program.provider as any).sendAndConfirm(tx, []);
        }

        // Vault claim → withdraw everything.
        const ownerKey = owner.toBase58();
        const all = await program.account.userVault.all([
          { memcmp: { offset: 8, bytes: ownerKey } },
        ]);
        const vaultAcc = all.find(
          (v: any) => toNumber(v.account.vaultId) === (params as any).vaultId && v.account.active
        );
        if (!vaultAcc) throw new Error('Vault not found.');
        const vaultAddress = vaultAcc.publicKey;
        const amount = BigInt(vaultAcc.account.balance?.toString?.() ?? 0);
        if (amount <= 0n) throw new Error('Vault is empty.');

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
    claim,
    txState: action.txState,
    txHash: action.txHash,
    error: action.error,
    isPending: action.isPending,
    isSuccess: action.txState === 'success',
    reset: action.reset,
  };
}
