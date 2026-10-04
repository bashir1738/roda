import { PublicKey, type Connection, type TransactionInstruction } from '@solana/web3.js';
import { createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { ataAddress } from './pdas';
import { getUsdcMint } from './mint';

/**
 * Returns the owner's USDC ATA plus a create-ATA instruction when it does not
 * exist yet (null ix when it already exists). `payer` defaults to the owner.
 */
export async function ensureUsdcAtaIx(
  connection: Connection,
  owner: PublicKey,
  payer?: PublicKey
): Promise<{ ata: PublicKey; ix: TransactionInstruction | null }> {
  const feePayer = payer ?? owner;
  const mint = getUsdcMint();
  const ata = ataAddress(mint, owner);
  const info = await connection.getAccountInfo(ata);
  return {
    ata,
    ix: info ? null : createAssociatedTokenAccountInstruction(feePayer, ata, owner, mint),
  };
}

export async function ensureTokenAtaIx(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
  payer?: PublicKey,
): Promise<{ ata: PublicKey; ix: TransactionInstruction | null }> {
  const feePayer = payer ?? owner;
  const ata = ataAddress(mint, owner);
  const info = await connection.getAccountInfo(ata);
  return {
    ata,
    ix: info ? null : createAssociatedTokenAccountInstruction(feePayer, ata, owner, mint),
  };
}
