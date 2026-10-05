import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Image,
} from 'react-native';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { createTransferInstruction } from '@solana/spl-token';
import { useColorScheme } from 'nativewind';
import { useProgramAction } from '../hooks/useProgramAction';
import { getConnection } from '../lib/connection';
import { ensureTokenAtaIx } from '../lib/token';
import { tokenAta } from '../lib/pdas';
import { getUsdcMint } from '../lib/mint';
import { isValidAddress, SKR_DECIMALS, SKR_MINT } from '../constants/roda';
import { resolveRecipient, type ResolvedRecipient } from '../lib/recipient';
import { Icon } from './Icon';
import { SolanaMark } from './SolanaMark';

type SendToken = 'SOL' | 'USDC' | 'SKR';

const TOKENS: { symbol: SendToken; decimals: number; bg: string }[] = [
  { symbol: 'SOL', decimals: 9, bg: '#9945FF' },
  { symbol: 'USDC', decimals: 6, bg: '#2775CA' },
  { symbol: 'SKR', decimals: SKR_DECIMALS, bg: '#111827' },
];

const SKR_ICON_URL = 'https://coin-images.coingecko.com/coins/images/70974/large/seeker-logo.jpg';

function SendAssetIcon({ symbol, backgroundColor }: { symbol: SendToken; backgroundColor: string }) {
  return (
    <View style={{
      width: 32, height: 32, borderRadius: 16,
      backgroundColor, alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {symbol === 'SOL' ? (
        <SolanaMark size={19} color="#FFFFFF" />
      ) : symbol === 'SKR' ? (
        <Image source={{ uri: SKR_ICON_URL }} style={{ width: 20, height: 20, borderRadius: 10 }} />
      ) : (
        <Text className="text-white font-bold text-xs">$</Text>
      )}
    </View>
  );
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SendSheet({ visible, onClose }: Props) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [token, setToken] = useState<SendToken>('SOL');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [recipient, setRecipient] = useState<ResolvedRecipient | null>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [resolvingRecipient, setResolvingRecipient] = useState(false);

  const { run, txState, error, reset } = useProgramAction();

  const toValid = isValidAddress(to.trim()) || /^[a-z0-9-]+(?:\.skr)?$/i.test(to.trim());
  const amountNum = amount ? parseFloat(amount) : 0;
  const amountValid = !!amount && !isNaN(amountNum) && amountNum > 0;
  const canSend = !!recipient && amountValid && txState !== 'signing' && !resolvingRecipient;

  const resetAll = () => {
    reset();
    setTo('');
    setAmount('');
    setToken('SOL');
    setRecipient(null);
    setRecipientError(null);
  };

  const handleClose = () => { resetAll(); onClose(); };

  const resolveInput = async (value = to) => {
    const input = value.trim();
    if (!input) {
      setRecipient(null);
      return;
    }
    setResolvingRecipient(true);
    setRecipientError(null);
    try {
      setRecipient(await resolveRecipient(input));
    } catch (e) {
      setRecipient(null);
      setRecipientError(e instanceof Error ? e.message : 'Could not resolve recipient.');
    } finally {
      setResolvingRecipient(false);
    }
  };

  const handleSend = async () => {
    let resolved = recipient;
    if (!resolved) {
      setResolvingRecipient(true);
      setRecipientError(null);
      try {
        resolved = await resolveRecipient(to.trim());
        setRecipient(resolved);
      } catch (e) {
        setRecipientError(e instanceof Error ? e.message : 'Could not resolve recipient.');
        setResolvingRecipient(false);
        return;
      }
      setResolvingRecipient(false);
    }
    if (!amountValid || txState === 'signing') return;
    await run(async (program, wallet) => {
      const owner = wallet.publicKey;
      const connection = getConnection();
      const dest = resolved.address;
      const tx = new Transaction();

      if (token === 'SOL') {
        const lamports = Math.round(amountNum * 1_000_000_000);
        tx.add(
          SystemProgram.transfer({ fromPubkey: owner, toPubkey: dest, lamports })
        );
      } else {
        const mint = token === 'USDC' ? getUsdcMint() : new PublicKey(SKR_MINT);
        const decimals = token === 'USDC' ? 6 : SKR_DECIMALS;
        const raw = Math.round(amountNum * 10 ** decimals);
        const { ata: destAta, ix } = await ensureTokenAtaIx(connection, mint, dest, owner);
        if (ix) tx.add(ix);
        tx.add(createTransferInstruction(tokenAta(mint, owner), destAta, owner, raw, [], undefined));
      }

      return (program.provider as any).sendAndConfirm(tx, []);
    });
  };

  useEffect(() => {
    if (txState !== 'success') return;
    const t = setTimeout(() => { resetAll(); onClose(); }, 2000);
    return () => clearTimeout(t);
  }, [txState]);

  const isSuccess = txState === 'success';
  const isPending = txState === 'signing';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-[#FDFBF7] dark:bg-[#121212]">
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-6 pb-4 border-b border-border/50 dark:border-white/5 bg-white dark:bg-[#121212]">
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text className="text-muted dark:text-[#A1A1AA] font-bold text-base">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-charcoal dark:text-white font-bold text-xl">Send</Text>
          <View className="w-12" />
        </View>

        <ScrollView contentContainerClassName="p-5" keyboardShouldPersistTaps="handled">
          {isSuccess ? (
            <View className="items-center py-16 gap-4">
              <View className="w-20 h-20 rounded-full bg-[#10B981]/20 items-center justify-center">
                <Icon name="checkmark-circle" size={48} color="#10B981" />
              </View>
              <Text className="text-charcoal dark:text-white font-extrabold text-3xl">Sent!</Text>
              <Text className="text-muted dark:text-[#A1A1AA] text-sm text-center font-medium">
                Your transaction was confirmed on devnet.
              </Text>
            </View>
          ) : isPending ? (
            <View className="items-center py-16 gap-4">
              <ActivityIndicator size="large" color="#421F6D" />
              <Text className="text-charcoal dark:text-white font-bold text-xl">
                Confirming on-chain…
              </Text>
              <Text className="text-muted dark:text-[#A1A1AA] text-sm font-medium">
                This takes a few seconds
              </Text>
            </View>
          ) : (
            <>
              {/* Token picker */}
              <View className="mb-6">
                <Text className="text-muted dark:text-[#A1A1AA] font-bold text-xs uppercase tracking-wider mb-3 ml-1">Asset</Text>
                <View className="flex-row gap-3">
                  {TOKENS.map((t) => (
                    <TouchableOpacity
                      key={t.symbol}
                      onPress={() => { setToken(t.symbol); setAmount(''); }}
                      className={`flex-1 flex-row items-center justify-center gap-2 py-4 rounded-3xl border ${token === t.symbol ? 'border-primary bg-primary/10' : 'border-border/50 dark:border-white/5 bg-white dark:bg-[#1C1C1E]'}`}
                    >
                      <SendAssetIcon symbol={t.symbol} backgroundColor={t.bg} />
                      <Text className={`font-bold text-base ${token === t.symbol ? 'text-primary' : 'text-charcoal dark:text-white'}`}>
                        {t.symbol}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Recipient */}
              <View className="mb-6">
                <Text className="text-muted dark:text-[#A1A1AA] font-bold text-xs uppercase tracking-wider mb-3 ml-1">To address</Text>
                <View className={`flex-row items-center gap-3 bg-white dark:bg-[#1C1C1E] rounded-3xl border ${to && !toValid ? 'border-[#EF4444]' : 'border-border/50 dark:border-white/5'} px-5 py-4`}>
                  <Icon name="wallet" size={20} color={isDark ? '#FFFFFF' : '#16141a'} />
                  <TextInput
                    className="flex-1 text-charcoal dark:text-white font-bold text-base"
                    placeholder="Address or name.skr…"
                    placeholderTextColor="#A1A1AA"
                    value={to}
                    onChangeText={(value) => {
                      setTo(value);
                      setRecipient(null);
                      setRecipientError(null);
                    }}
                    onEndEditing={() => { void resolveInput(); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {toValid && <Icon name="checkmark-circle" size={20} color="#10B981" />}
                </View>
                {resolvingRecipient && (
                  <Text className="text-muted dark:text-[#A1A1AA] font-bold text-xs mt-2 ml-1">Resolving recipient…</Text>
                )}
                {recipient && (
                  <Text className="text-[#10B981] font-bold text-xs mt-2 ml-1">
                    {recipient.name ? `${recipient.name} · ` : ''}{recipient.address.toBase58()}
                  </Text>
                )}
                {to && !toValid && !recipientError && (
                  <Text className="text-[#EF4444] font-bold text-xs mt-2 ml-1">Invalid address or .skr name</Text>
                )}
                {recipientError && (
                  <Text className="text-[#EF4444] font-bold text-xs mt-2 ml-1">{recipientError}</Text>
                )}
              </View>

              {/* Amount */}
              <View className="mb-8">
                <Text className="text-muted dark:text-[#A1A1AA] font-bold text-xs uppercase tracking-wider mb-3 ml-1">Amount</Text>
                <View className="flex-row items-center gap-3 bg-white dark:bg-[#1C1C1E] rounded-3xl border border-border/50 dark:border-white/5 px-5 py-4">
                  <TextInput
                    className="flex-1 text-charcoal dark:text-white font-extrabold text-3xl"
                    placeholder="0"
                    placeholderTextColor="#A1A1AA"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                  />
                  <View className="bg-border/50 dark:bg-white/10 px-3 py-1.5 rounded-full">
                    <Text className="text-charcoal dark:text-white font-bold text-xs">{token}</Text>
                  </View>
                </View>
                {error && txState === 'error' && (
                  <Text className="text-[#EF4444] font-bold text-xs mt-2 ml-1">{error}</Text>
                )}
              </View>

              {/* Send button */}
              <TouchableOpacity
                onPress={handleSend}
                disabled={!canSend}
                className={`flex-row items-center justify-center gap-2 py-5 rounded-full shadow-lg ${canSend ? 'bg-primary' : 'bg-primary/50'}`}
              >
                <Icon name="arrow-up" size={24} color="#FFFFFF" />
                <Text className="text-white font-bold text-lg">
                  Send {amount && amountValid ? `${amount} ${token}` : ''}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
