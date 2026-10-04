import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { PublicKey } from '@solana/web3.js';
import {
  clearKeypair,
  getStoredEmail,
  loadKeypair,
  saveActiveAddress,
  saveEmail,
  toAnchorWallet,
  type SolanaWallet,
} from '../lib/wallet';
import { getMagic, isMagicEnabled, toMagicWallet } from '../lib/magic';
import { connectMwa, disconnectMwa } from '../lib/mwa';
import { CLUSTER } from '../constants/roda';

const WALLET_INACTIVITY_MS = 15 * 60 * 1000;
const ONBOARDING_COMPLETE_KEY = 'roda_onboarding_complete';

export type TxState = 'idle' | 'signing' | 'confirming' | 'success' | 'error';

/** Which wallet backend backs the current session. */
export type WalletKind = 'device' | 'magic' | 'mwa';

interface WalletContextValue {
  /** base58 public key of the connected wallet. */
  address: string | undefined;
  publicKey: PublicKey | undefined;
  /** Sign-capable wallet for Anchor calls. */
  wallet: SolanaWallet | undefined;
  /** Where the active wallet comes from (device keypair or Magic). */
  walletKind: WalletKind | undefined;
  /** Email tied to the session (Magic sign-in, or stored legacy address). */
  email: string | undefined;
  isConnected: boolean;
  cluster: string;
  connect: () => void;
  connectMwa: () => Promise<void>;
  disconnect: (preserveEmail?: boolean) => Promise<void>;
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
  email: undefined,
  isConnected: false,
  cluster: CLUSTER,
  connect: noop,
  connectMwa: async () => {},
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
  const [email, setEmail] = useState<string | undefined>(undefined);
  const [isReady, setIsReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginVisible, setLoginVisible] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

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
            SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, '1').catch(() => {});
            getStoredEmail()
              .then((stored) => {
                if (!cancelled && stored) setEmail(stored);
              })
              .catch(() => {});
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
          SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, '1').catch(() => {});
          // Show the persisted email immediately, then refresh from Magic.
          try {
            const stored = await getStoredEmail();
            if (!cancelled && stored) setEmail(stored);
          } catch {
            // No persisted email.
          }
          try {
            const info = await magic.user.getInfo();
            if (!cancelled && info.email) {
              setEmail(info.email);
              saveEmail(info.email).catch(() => {});
            }
          } catch {
            // Keep whatever was shown from storage.
          }
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
      const typed = email.trim();
      const magic = getMagic();
      // Drop our sheet as soon as Magic's OTP screen comes up, so only the
      // OTP UI is visible during onboarding/sign-in.
      setLoginVisible(false);
      try {
        await magic.auth.loginWithEmailOTP({ email: typed, showUI: true });
      } catch (e) {
        // Bring the sheet back so the user can see why sign-in didn't finish.
        setLoginVisible(true);
        throw e;
      }
      const address = await magic.solana.getPublicAddress();
      setWallet(toMagicWallet(magic, new PublicKey(address)));
      setWalletKind('magic');
      await SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, '1');
      // Set the email right away — don't wait on getInfo(), which can hang
      // or fail and would leave the profile page with nothing to show.
      setEmail(typed);
      saveEmail(typed).catch(() => {});
      try {
        const info = await magic.user.getInfo();
        if (info.email && info.email !== typed) {
          setEmail(info.email);
          saveEmail(info.email).catch(() => {});
        }
      } catch {
        // Typed address already shown — nothing else to do.
      }
    } finally {
      setIsLoggingIn(false);
    }
  }, []);

  const loginWithMwa = useCallback(async () => {
    const mwaWallet = await connectMwa();
    setWallet(mwaWallet);
    setWalletKind('mwa');
    await SecureStore.setItemAsync(ONBOARDING_COMPLETE_KEY, '1');
  }, []);

  const disconnect = useCallback(async (preserveEmail = false) => {
    await clearKeypair(preserveEmail);
    if (walletKind === 'magic' && isMagicEnabled) {
      try {
        await getMagic().user.logout();
      } catch {
        // Session cleanup is best-effort.
      }
    }
    if (walletKind === 'mwa') {
      try {
        await disconnectMwa();
      } catch {
        // Native wallet session cleanup is best-effort.
      }
    }
    setWallet(undefined);
    setWalletKind(undefined);
    setEmail(undefined);
    if (preserveEmail) {
      const storedEmail = await getStoredEmail();
      if (storedEmail) setEmail(storedEmail);
    }
  }, [walletKind]);

  useEffect(() => {
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (state !== 'active' || !backgroundedAt.current || !wallet) return;
      const elapsed = Date.now() - backgroundedAt.current;
      backgroundedAt.current = null;
      if (elapsed < WALLET_INACTIVITY_MS) return;
      disconnect(true)
        .then(() => setLoginVisible(true))
        .catch(() => {});
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [disconnect, wallet]);

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
        email,
        isConnected: isAuthenticated,
        cluster: CLUSTER,
        connect,
        connectMwa: loginWithMwa,
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
