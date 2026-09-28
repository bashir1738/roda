import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import type { PublicKey } from '@solana/web3.js';
import {
  clearKeypair,
  createKeypair,
  importKeypair,
  loadKeypair,
  toAnchorWallet,
  type SolanaWallet,
} from '../lib/wallet';
import { CLUSTER } from '../constants/roda';

export type TxState = 'idle' | 'signing' | 'confirming' | 'success' | 'error';

interface WalletContextValue {
  /** base58 public key of the device wallet. */
  address: string | undefined;
  publicKey: PublicKey | undefined;
  /** Sign-capable wallet for Anchor calls. */
  wallet: SolanaWallet | undefined;
  isConnected: boolean;
  cluster: string;
  connect: () => void;
  disconnect: () => Promise<void>;
  isReady: boolean;
  isAuthenticated: boolean;
  isWalletReady: boolean;
  /** Generate a fresh device wallet. */
  createWallet: () => Promise<void>;
  /** Import an existing wallet from its base58 secret key. */
  importWallet: (secretBase58: string) => Promise<void>;
  isLoggingIn: boolean;
  loginVisible: boolean;
  closeLogin: () => void;
}

const noop = () => {};

const WalletContext = createContext<WalletContextValue>({
  address: undefined,
  publicKey: undefined,
  wallet: undefined,
  isConnected: false,
  cluster: CLUSTER,
  connect: noop,
  disconnect: async () => {},
  isReady: false,
  isAuthenticated: false,
  isWalletReady: false,
  createWallet: async () => {},
  importWallet: async () => {},
  isLoggingIn: false,
  loginVisible: false,
  closeLogin: noop,
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<SolanaWallet | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginVisible, setLoginVisible] = useState(false);

  // Restore the device wallet on mount.
  useEffect(() => {
    let cancelled = false;
    loadKeypair()
      .then((kp) => {
        if (!cancelled && kp) setWallet(toAnchorWallet(kp));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((kp: Awaited<ReturnType<typeof loadKeypair>>) => {
    if (kp) setWallet(toAnchorWallet(kp));
  }, []);

  const createWallet = useCallback(async () => {
    setIsLoggingIn(true);
    try {
      const kp = await createKeypair();
      persist(kp);
      setLoginVisible(false);
    } finally {
      setIsLoggingIn(false);
    }
  }, [persist]);

  const importWallet = useCallback(
    async (secretBase58: string) => {
      setIsLoggingIn(true);
      try {
        const kp = await importKeypair(secretBase58);
        persist(kp);
        setLoginVisible(false);
      } finally {
        setIsLoggingIn(false);
      }
    },
    [persist]
  );

  const disconnect = useCallback(async () => {
    await clearKeypair();
    setWallet(undefined);
  }, []);

  const connect = useCallback(() => setLoginVisible(true), []);
  const closeLogin = useCallback(() => setLoginVisible(false), []);

  const isAuthenticated = !!wallet;
  const address: string | undefined = wallet?.publicKey?.toBase58();

  return (
    <WalletContext.Provider
      value={{
        address,
        publicKey: wallet?.publicKey,
        wallet,
        isConnected: isAuthenticated,
        cluster: CLUSTER,
        connect,
        disconnect,
        isReady,
        isAuthenticated,
        isWalletReady: isAuthenticated && !!address,
        createWallet,
        importWallet,
        isLoggingIn,
        loginVisible,
        closeLogin,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => useContext(WalletContext);
