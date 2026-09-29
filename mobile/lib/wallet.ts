import * as SecureStore from 'expo-secure-store';
import { Keypair, PublicKey, type Transaction, type VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

const KEYPAIR_STORE = 'roda_solana_keypair_v1';
const EMAIL_STORE = 'roda_solana_email_v1';
const ADDRESS_STORE = 'roda_solana_address_v1';

export interface SolanaWallet {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}

/** Load the device keypair from SecureStore (null if none exists yet). */
export async function loadKeypair(): Promise<Keypair | null> {
  try {
    const encoded = await SecureStore.getItemAsync(KEYPAIR_STORE);
    if (!encoded) return null;
    return Keypair.fromSecretKey(bs58.decode(encoded.trim()));
  } catch {
    return null;
  }
}

/** Remove the device wallet (sign-out). */
export async function clearKeypair(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYPAIR_STORE);
  await SecureStore.deleteItemAsync(EMAIL_STORE);
  await SecureStore.deleteItemAsync(ADDRESS_STORE);
}

/**
 * Persist the active address (device or Magic wallet) so background tasks —
 * which have no React context — can read it from SecureStore.
 */
export async function saveActiveAddress(address: string): Promise<void> {
  await SecureStore.setItemAsync(ADDRESS_STORE, address);
}

export async function getStoredAddress(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(ADDRESS_STORE);
  } catch {
    return null;
  }
}

export async function getStoredEmail(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(EMAIL_STORE);
  } catch {
    return null;
  }
}

/** Persist the email tied to the session so it survives app restarts. */
export async function saveEmail(email: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(EMAIL_STORE, email);
  } catch {
    // Non-fatal — the profile just won't remember the email.
  }
}

/** Expose a Keypair as an Anchor-compatible wallet. */
export function toAnchorWallet(keypair: Keypair): SolanaWallet {
  return {
    publicKey: keypair.publicKey,
    async signTransaction(tx) {
      if ('partialSign' in tx) {
        (tx as Transaction).partialSign(keypair);
      } else {
        (tx as VersionedTransaction).sign([keypair]);
      }
      return tx;
    },
    async signAllTransactions(txs) {
      return Promise.all(txs.map((tx) => this.signTransaction(tx)));
    },
  };
}

/** Read-only wallet placeholder for fetching (no signing happens). */
export function readOnlyWallet(): SolanaWallet {
  const keypair = Keypair.generate();
  return toAnchorWallet(keypair);
}
