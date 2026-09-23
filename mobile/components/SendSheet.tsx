import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSendTransaction, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, parseUnits, isAddress } from 'viem';
import { TOKEN_ADDRESSES } from '../constants/addresses';
import { useColorScheme } from 'nativewind';

type SendToken = 'ETH' | 'USDC';

const TOKENS: { symbol: SendToken; label: string; decimals: number; bg: string }[] = [
  { symbol: 'ETH',  label: 'Ξ', decimals: 18, bg: '#627EEA' },
  { symbol: 'USDC', label: '$', decimals: 6,  bg: '#2775CA' },
];

const ERC20_TRANSFER_ABI = [
  {
    name: 'transfer',
    type: 'function' as const,
    stateMutability: 'nonpayable' as const,
    inputs: [
      { name: 'to',     type: 'address' as const },
      { name: 'amount', type: 'uint256' as const },
    ],
    outputs: [{ name: '', type: 'bool' as const }],
  },
] as const;

function tokenAddress(symbol: SendToken): `0x${string}` | undefined {
  if (symbol === 'USDC') return TOKEN_ADDRESSES.USDC;
  return undefined;
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function SendSheet({ visible, onClose }: Props) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [token, setToken] = useState<SendToken>('ETH');
  const [to, setTo]       = useState('');
  const [amount, setAmount] = useState('');

  const {
    sendTransaction, data: ethHash,
    isPending: ethPending, reset: ethReset,
  } = useSendTransaction();

  const {
    writeContract, data: erc20Hash,
    isPending: erc20Pending, reset: erc20Reset,
  } = useWriteContract();

  const txHash = ethHash ?? erc20Hash;
  const isPending = ethPending || erc20Pending;

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const toValid     = isAddress(to);
  const amountValid = !!amount && !isNaN(parseFloat(amount)) && parseFloat(amount) > 0;
  const canSend     = toValid && amountValid && !isPending && !isConfirming;

  const resetAll = () => {
    ethReset(); erc20Reset();
    setTo(''); setAmount('');
    setToken('ETH');
  };

  const handleClose = () => { resetAll(); onClose(); };

  const handleSend = async () => {
    if (!canSend) return;
    const addr = to.trim() as `0x${string}`;
    const def = TOKENS.find((t) => t.symbol === token)!;

    if (token === 'ETH') {
      sendTransaction({ to: addr, value: parseEther(amount) });
    } else {
      writeContract({
        address: tokenAddress(token)!,
        abi: ERC20_TRANSFER_ABI,
        functionName: 'transfer',
        args: [addr, parseUnits(amount, def.decimals)],
      });
    }
  };

  useEffect(() => {
    if (!isSuccess) return;
    const t = setTimeout(() => { resetAll(); onClose(); }, 2000);
    return () => clearTimeout(t);
  }, [isSuccess]);

  const showSpinner = isPending || isConfirming;

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
                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
              </View>
              <Text className="text-charcoal dark:text-white font-extrabold text-3xl">Sent!</Text>
              <Text className="text-muted dark:text-[#A1A1AA] text-sm text-center font-medium">
                Your transaction was confirmed on Sepolia.
              </Text>
            </View>
          ) : showSpinner ? (
            <View className="items-center py-16 gap-4">
              <ActivityIndicator size="large" color="#421F6D" />
              <Text className="text-charcoal dark:text-white font-bold text-xl">
                {isPending ? 'Waiting for signature…' : 'Confirming on-chain…'}
              </Text>
              <Text className="text-muted dark:text-[#A1A1AA] text-sm font-medium">
                {isConfirming ? 'This takes ~15 seconds' : 'Approve in your wallet'}
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
                      <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: t.bg }}>
                        <Text className="text-white font-bold text-xs">{t.label}</Text>
                      </View>
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
                  <Ionicons name="wallet" size={20} color={isDark ? '#FFFFFF' : '#16141a'} />
                  <TextInput
                    className="flex-1 text-charcoal dark:text-white font-bold text-base"
                    placeholder="0x…"
                    placeholderTextColor="#A1A1AA"
                    value={to}
                    onChangeText={setTo}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {toValid && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
                </View>
                {to && !toValid && (
                  <Text className="text-[#EF4444] font-bold text-xs mt-2 ml-1">Invalid address</Text>
                )}
              </View>

              {/* Amount */}
              <View className="mb-8">
                <Text className="text-muted dark:text-[#A1A1AA] font-bold text-xs uppercase tracking-wider mb-3 ml-1">Amount</Text>
                <View className="flex-row items-center gap-3 bg-white dark:bg-[#1C1C1E] rounded-3xl border border-border/50 dark:border-white/5 px-5 py-4">
                  <Text className="text-charcoal dark:text-white font-extrabold text-3xl">$</Text>
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
              </View>

              {/* Send button */}
              <TouchableOpacity
                onPress={handleSend}
                disabled={!canSend}
                className={`flex-row items-center justify-center gap-2 py-5 rounded-full shadow-lg ${canSend ? 'bg-primary' : 'bg-primary/50'}`}
              >
                <Ionicons name="arrow-up" size={24} color="#FFFFFF" />
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
