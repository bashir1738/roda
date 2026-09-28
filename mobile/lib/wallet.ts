import * as SecureStore from 'expo-secure-store';
import { Keypair, PublicKey, type Transaction, type VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

const KEYPAIR_STORE = 'roda_solana_keypair_v1';
const EMAIL_STORE = 'roda_solana_email_v1';

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

/** Generate a new device keypair and persist it. */
export async function createKeypair(email?: string): Promise<Keypair> {
  const keypair = Keypair.generate();
  await SecureStore.setItemAsync(KEYPAIR_STORE, bs58.encode(keypair.secretKey));
  if (email) await SecureStore.setItemAsync(EMAIL_STORE, email.trim().toLowerCase());
  return keypair;
}

/** Import an existing wallet from a base58-encoded 64-byte secret key. */
export async function importKeypair(secretBase58: string): Promise<Keypair> {
  const trimmed = secretBase58.trim();
  let bytes: Uint8Array;
  try {
    bytes = bs58.decode(trimmed);
  } catch {
    throw new Error('That does not look like a base58 secret key.');
  }
  if (bytes.length !== 64 && bytes.length !== 32) {
    throw new Error('Secret key must be a 64-byte (or 32-byte seed) base58 string.');
  }
  const keypair =
    bytes.length === 32 ? Keypair.fromSeed(bytes) : Keypair.fromSecretKey(bytes);
  await SecureStore.setItemAsync(KEYPAIR_STORE, bs58.encode(keypair.secretKey));
  return keypair;
}

/** Remove the device wallet (sign-out). */
export async function clearKeypair(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYPAIR_STORE);
  await SecureStore.deleteItemAsync(EMAIL_STORE);
}

export async function getStoredEmail(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(EMAIL_STORE);
  } catch {
    return null;
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
