import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { PublicKey } from '@solana/web3.js';
import {
  clearKeypair,
  loadKeypair,
  saveActiveAddress,
  toAnchorWallet,
  type SolanaWallet,
} from '../lib/wallet';
import { getMagic, isMagicEnabled, toMagicWallet } from '../lib/magic';
import { CLUSTER } from '../constants/roda';

export type TxState = 'idle' | 'signing' | 'confirming' | 'success' | 'error';

/** Which wallet backend backs the current session. */
export type WalletKind = 'device' | 'magic';

interface WalletContextValue {
  /** base58 public key of the connected wallet. */
  address: string | undefined;
  publicKey: PublicKey | undefined;
  /** Sign-capable wallet for Anchor calls. */
  wallet: SolanaWallet | undefined;
  /** Where the active wallet comes from (device keypair or Magic). */
  walletKind: WalletKind | undefined;
  isConnected: boolean;
  cluster: string;
  connect: () => void;
  disconnect: () => Promise<void>;
  isReady: boolean;
  isAuthenticated: boolean;
  isWalletReady: boolean;
  /** Sign in with email — Magic creates/opens an embedded Solana wallet. */
  loginWithEmail: (email: string) => Promise<void>;
  isLoggingIn: boolean;
  loginVisible: boolean;
  closeLogin: () => void;
}

const noop = () => {};

const WalletContext = createContext<WalletContextValue>({
  address: undefined,
  publicKey: undefined,
  wallet: undefined,
  walletKind: undefined,
  isConnected: false,
  cluster: CLUSTER,
  connect: noop,
  disconnect: async () => {},
  isReady: false,
  isAuthenticated: false,
  isWalletReady: false,
  loginWithEmail: async () => {},
  isLoggingIn: false,
  loginVisible: false,
  closeLogin: noop,
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [wallet, setWallet] = useState<SolanaWallet | undefined>(undefined);
  const [walletKind, setWalletKind] = useState<WalletKind | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginVisible, setLoginVisible] = useState(false);

  // Restore the device wallet, falling back to an existing Magic session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const kp = await loadKeypair();
        if (kp) {
          if (!cancelled) {
            setWallet(toAnchorWallet(kp));
            setWalletKind('device');
          }
          return;
        }
        if (isMagicEnabled) {
          const magic = getMagic();
          if (!(await magic.user.isLoggedIn())) return;
          const address = await magic.solana.getPublicAddress();
          if (cancelled) return;
          setWallet(toMagicWallet(magic, new PublicKey(address)));
          setWalletKind('magic');
        }
      } catch {
        // Restore failures just mean the user has to sign in again.
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loginWithEmail = useCallback(async (email: string) => {
    setIsLoggingIn(true);
    try {
      const magic = getMagic();
      await magic.auth.loginWithEmailOTP({ email: email.trim(), showUI: true });
      const address = await magic.solana.getPublicAddress();
      setWallet(toMagicWallet(magic, new PublicKey(address)));
      setWalletKind('magic');
      setLoginVisible(false);
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await clearKeypair();
    if (walletKind === 'magic' && isMagicEnabled) {
      try {
        await getMagic().user.logout();
      } catch {
        // Session cleanup is best-effort.
      }
    }
    setWallet(undefined);
    setWalletKind(undefined);
  }, [walletKind]);

  const connect = useCallback(() => setLoginVisible(true), []);
  const closeLogin = useCallback(() => setLoginVisible(false), []);

  const isAuthenticated = !!wallet;
  const address: string | undefined = wallet?.publicKey?.toBase58();

  // Background notification checks read the active address from SecureStore
  // (works for device and Magic wallets alike).
  useEffect(() => {
    if (address) saveActiveAddress(address).catch(() => {});
  }, [address]);

  return (
    <WalletContext.Provider
      value={{
        address,
        publicKey: wallet?.publicKey,
        wallet,
        walletKind,
        isConnected: isAuthenticated,
        cluster: CLUSTER,
        connect,
        disconnect,
        isReady,
        isAuthenticated,
        isWalletReady: isAuthenticated && !!address,
        loginWithEmail,
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
