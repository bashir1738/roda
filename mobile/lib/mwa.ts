import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import type { SolanaWallet } from './wallet';

type MwaAdapter = import('@solana-mobile/wallet-adapter-mobile').SolanaMobileWalletAdapter;

let adapter: MwaAdapter | null = null;

async function getAdapter(): Promise<MwaAdapter> {
  if (!adapter) {
    try {
      const {
        SolanaMobileWalletAdapter,
        createDefaultAddressSelector,
        createDefaultAuthorizationResultCache,
      } = await import('@solana-mobile/wallet-adapter-mobile');
      adapter = new SolanaMobileWalletAdapter({
        addressSelector: createDefaultAddressSelector(),
        appIdentity: {
          name: 'Roda',
          uri: 'https://roda-lime.vercel.app',
          icon: '/assets/images/icon.png',
        },
        authorizationResultCache: createDefaultAuthorizationResultCache(),
        chain: 'solana:devnet',
        onWalletNotFound: async () => {
          throw new Error('No compatible Solana wallet was found on this device.');
        },
      });
    } catch {
      throw new Error('Seeker wallet support requires a Roda Android development or preview build.');
    }
  }
  return adapter;
}

export async function connectMwa(): Promise<SolanaWallet> {
  const wallet = await getAdapter();
  await wallet.connect();
  if (!wallet.publicKey) throw new Error('The wallet did not return an address.');
  const publicKey = wallet.publicKey;

  return {
    publicKey,
    signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) =>
      wallet.signTransaction(tx),
    signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]) =>
      wallet.signAllTransactions(txs),
  };
}

export async function disconnectMwa(): Promise<void> {
  if (adapter?.connected) await adapter.disconnect();
}

export function isMwaConnected(): boolean {
  return !!adapter?.connected && !!adapter.publicKey;
}

export function getMwaPublicKey(): PublicKey | undefined {
  return adapter?.publicKey ?? undefined;
}
