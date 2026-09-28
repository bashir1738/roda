import { AnchorProvider, Program } from '@anchor-lang/core';
import { RODA_IDL } from '../constants/idl';
import { getConnection } from './connection';
import { readOnlyWallet, type SolanaWallet } from './wallet';

type AnyProgram = Omit<Program<any>, 'account'> & {
  // The IDL is static; account namespace resolves at runtime.
  account: Record<string, any>;
};

export function getProvider(wallet?: SolanaWallet): AnchorProvider {
  return new AnchorProvider(getConnection(), (wallet ?? readOnlyWallet()) as any, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  });
}

/** Anchor program bound to a wallet (or a read-only placeholder). */
export function getProgram(wallet?: SolanaWallet): AnyProgram {
  // The IDL is generated from the deployed program — cast past the readonly const.
  return new Program(RODA_IDL as any, getProvider(wallet)) as AnyProgram;
}

export type { AnyProgram };
