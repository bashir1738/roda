import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type TxType = 'payout' | 'contribution' | 'deposit' | 'interest' | 'claim' | 'circle_create' | 'circle_join';

export interface Transaction {
  id: string;
  type: TxType;
  label: string;
  subLabel?: string;
  date: Date;
  amountUSDC: bigint;
  txHash?: string;
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TYPE_META: Record<TxType, { icon: IoniconsName; iconColor: string; incoming: boolean; bg: string }> = {
  payout:        { icon: 'cash-outline',           iconColor: '#22c55e', incoming: true,  bg: 'rgba(74, 222, 128, 0.15)' },
  contribution:  { icon: 'card-outline',           iconColor: '#16141a', incoming: false, bg: '#F3F4F6' },
  deposit:       { icon: 'wallet-outline',          iconColor: '#16141a', incoming: false, bg: '#F3F4F6' },
  interest:      { icon: 'trending-up-outline',     iconColor: '#22c55e', incoming: true,  bg: 'rgba(74, 222, 128, 0.15)' },
  claim:         { icon: 'gift-outline',            iconColor: '#22c55e', incoming: true,  bg: 'rgba(74, 222, 128, 0.15)' },
  circle_create: { icon: 'people-circle-outline',   iconColor: '#16141a', incoming: false, bg: '#F3F4F6' },
  circle_join:   { icon: 'enter-outline',           iconColor: '#16141a', incoming: false, bg: '#F3F4F6' },
};

function fmtUSDC(v: bigint) {
  return (Number(v < 0n ? -v : v) / 1_000_000).toLocaleString('en-US', {
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  });
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function TransactionItem({ tx }: { tx: Transaction }) {
  const meta = TYPE_META[tx.type];

  return (
    <View
      className="flex-row items-center px-5 py-3"
      accessibilityLabel={`${tx.label} ${fmtUSDC(tx.amountUSDC)} USDC`}
    >
      <View
        className="w-12 h-12 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: meta.bg }}
      >
        <Ionicons name={meta.icon} size={20} color={meta.iconColor} />
      </View>

      <View className="flex-1">
        <Text className="text-charcoal dark:text-white font-bold text-base" numberOfLines={1}>
          {tx.label}
        </Text>
        <Text className="text-muted dark:text-[#A1A1AA] text-xs mt-0.5">
          {tx.subLabel ? `${tx.subLabel} · ` : ''}{fmtDate(tx.date)}
        </Text>
      </View>

      <View className="items-end gap-0.5">
        {tx.amountUSDC > 0n ? (
          <Text className={`font-extrabold text-base ${meta.incoming ? 'text-[#22c55e]' : 'text-charcoal'}`}>
            {meta.incoming ? '+' : '-'}${fmtUSDC(tx.amountUSDC)}
          </Text>
        ) : (
          <Text className="text-muted dark:text-[#A1A1AA] text-xs font-medium">on-chain</Text>
        )}
        {tx.txHash && (
          <View className="flex-row items-center gap-1">
            <Ionicons name="link-outline" size={12} color="#6B6B6B" />
          </View>
        )}
      </View>
    </View>
  );
}
