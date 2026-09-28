import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SystemProgram } from '@solana/web3.js';
import { useWallet } from '../providers/WalletContext';
import { getProgram } from '../lib/program';
import { nameProfilePda, registeredNamePda } from '../lib/pdas';
import { useProgramAction } from './useProgramAction';

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

export type ClaimState = 'idle' | 'signing' | 'confirming' | 'success' | 'error';

export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** Program validation rules → null when valid, else a friendly message. */
export function validateName(name: string): string | null {
  const n = normalizeName(name);
  if (n.length < USERNAME_MIN) return `Name must be at least ${USERNAME_MIN} characters.`;
  if (n.length > USERNAME_MAX) return `Name must be at most ${USERNAME_MAX} characters.`;
  if (!/^[a-z0-9_]+$/.test(n)) return 'Use lowercase letters, numbers and underscores only.';
  return null;
}

/** Standalone — safe to call outside a hook context. */
export async function checkNameAvailable(name: string): Promise<boolean> {
  const n = normalizeName(name);
  if (validateName(n)) return false;
  try {
    const program = getProgram();
    const rec: any = await program.account.registeredName
      .fetchNullable(registeredNamePda(n))
      .catch(() => null);
    return !rec;
  } catch {
    return false;
  }
}

export function useUsername(address?: string) {
  const { address: myAddress, wallet } = useWallet();
  const target = address ?? myAddress;
  const action = useProgramAction();

  const { data: onChainName, refetch } = useQuery<string | null>({
    queryKey: ['name', target],
    enabled: !!target,
    staleTime: 30_000,
    queryFn: async () => {
      const program = getProgram();
      const profile: any = await program.account.nameProfile
        .fetchNullable(nameProfilePda(target!))
        .catch(() => null);
      const n: string = profile?.name ?? '';
      return n.length ? n : null;
    },
  });

  const claim = useCallback(
    async (name: string) => {
      const n = normalizeName(name);
      const invalid = validateName(n);
      if (invalid) return action.run(async () => {
        throw new Error(invalid);
      });
      return action.run(async (program, w) => {
        const owner = w.publicKey;
        const profile: any = await program.account.nameProfile
          .fetchNullable(nameProfilePda(owner))
          .catch(() => null);
        const current: string = profile?.name ?? '';
        const accounts: Record<string, any> = {
          profile: nameProfilePda(owner),
          nameRecord: registeredNamePda(n),
          oldNameRecord: current && current !== n ? registeredNamePda(current) : null,
          owner,
          systemProgram: SystemProgram.programId,
        };
        const sig = await program.methods.claimName(n).accountsPartial(accounts).rpc();
        refetch();
        return sig;
      });
    },
    [action, refetch]
  );

  const release = useCallback(async () => {
    return action.run(async (program, w) => {
      const owner = w.publicKey;
      const profile: any = await program.account.nameProfile
        .fetchNullable(nameProfilePda(owner))
        .catch(() => null);
      const current: string = profile?.name ?? '';
      if (!current) throw new Error('This wallet has no username yet.');
      const sig = await program.methods
        .releaseName()
        .accountsPartial({
          profile: nameProfilePda(owner),
          nameRecord: registeredNamePda(current),
          owner,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      refetch();
      return sig;
    });
  }, [action, refetch]);

  return {
    onChainName: onChainName ?? null,
    claimState: action.txState,
    claimError: action.error,
    txHash: action.txHash,
    claim,
    release,
    reset: action.reset,
    isPending: action.isPending,
    isSuccess: action.txState === 'success',
  };
}
