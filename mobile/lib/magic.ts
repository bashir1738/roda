import { Magic } from '@magic-sdk/react-native-expo';
import { SolanaExtension } from '@magic-ext/solana';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { RPC_URL } from '../constants/roda';
import type { SolanaWallet } from './wallet';

const PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_MAGIC_PUBLISHABLE_KEY;

/**
 * Magic is optional: without a publishable key the app only offers the local
 * device wallet. The secret key must never ship in the client bundle.
 */
export const isMagicEnabled = !!PUBLISHABLE_KEY;

function createClient(key: string) {
  return new Magic(key, {
    extensions: [new SolanaExtension({ rpcUrl: RPC_URL })],
  });
}

export type MagicClient = ReturnType<typeof createClient>;

let client: MagicClient | null = null;

export function getMagic(): MagicClient {
  if (!PUBLISHABLE_KEY) {
    throw new Error('Magic is not configured — set EXPO_PUBLIC_MAGIC_PUBLISHABLE_KEY.');
  }
  if (!client) client = createClient(PUBLISHABLE_KEY);
  return client;
}

/**
 * Adapt Magic's embedded Solana wallet to the app's SolanaWallet interface so
 * every Anchor/transfer call signs through Magic without further changes.
 */
export function toMagicWallet(magic: MagicClient, publicKey: PublicKey): SolanaWallet {
  const signOne = async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
    const { rawTransaction } = await magic.solana.signTransaction(tx, {
      requireAllSignatures: false,
      verifySignatures: true,
    });
    const bytes =
      rawTransaction instanceof Uint8Array
        ? rawTransaction
        : Buffer.from(String(rawTransaction), 'base64');
    const signed =
      tx instanceof VersionedTransaction
        ? VersionedTransaction.deserialize(bytes)
        : Transaction.from(bytes);
    return signed as T;
  };

  return {
    publicKey,
    signTransaction: signOne,
    signAllTransactions: (txs) => Promise.all(txs.map((tx) => signOne(tx))),
  };
}
