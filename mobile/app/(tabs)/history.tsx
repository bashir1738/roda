import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TransactionItem, type Transaction, type TxType } from '../../components/TransactionItem';
import { useWallet } from '../../providers/WalletContext';

// On-chain activity feed. Transactions are sourced from contract events; until an
// indexer is wired up this starts empty and fills as the wallet transacts.
const TRANSACTIONS: Transaction[] = [];

type Filter = 'All' | 'Payouts' | 'Contributions' | 'Vaults';
const FILTERS: Filter[] = ['All', 'Payouts', 'Contributions', 'Vaults'];
const FILTER_TYPES: Record<Filter, TxType[]> = {
  All:           ['payout', 'contribution', 'deposit', 'interest', 'claim'],
  Payouts:       ['payout', 'claim'],
  Contributions: ['contribution'],
  Vaults:        ['deposit', 'interest'],
};
const FILTER_ICONS: Record<Filter, React.ComponentProps<typeof Ionicons>['name']> = {
  All:           'list-outline',
  Payouts:       'cash-outline',
  Contributions: 'arrow-up-circle-outline',
  Vaults:        'leaf-outline',
};

export default function HistoryTab() {
  const { isConnected } = useWallet();
  const [active, setActive] = useState<Filter>('All');

  const filtered = useMemo(
    () => TRANSACTIONS.filter((tx) => FILTER_TYPES[active].includes(tx.type)),
    [active],
  );

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-[#121212]" edges={['top']}>
      {/* Header */}
      <View className="bg-white dark:bg-[#121212] px-5 pt-3 pb-6">
        <Text className="text-charcoal dark:text-white text-[28px] font-extrabold tracking-tight mt-2">History</Text>
        <Text className="text-muted dark:text-[#A1A1AA] text-sm mt-1">
          {isConnected ? `${filtered.length} transactions` : 'Your on-chain activity'}
        </Text>
      </View>

      <View className="flex-1 bg-white dark:bg-[#121212] rounded-t-3xl overflow-hidden">
      {/* Filter chips */}
      <View className="flex-row gap-2 px-4 py-3 pt-4">
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            className={`flex-row items-center gap-1 px-3 py-1.5 rounded-full border ${
              active === f ? 'bg-primary border-primary' : 'bg-white border-border'
            }`}
            onPress={() => setActive(f)}
            accessibilityLabel={`Filter: ${f}`}
          >
            <Ionicons name={FILTER_ICONS[f]} size={13} color={active === f ? '#EDD2F8' : '#6B6B6B'} />
            <Text className={`text-xs font-semibold ${active === f ? 'text-surface' : 'text-muted'}`}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!isConnected ? (
        <EmptyState
          icon="wallet-outline"
          title="Connect your wallet"
          subtitle="Your transaction history will appear here once connected."
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(tx) => tx.id}
          renderItem={({ item }) => <TransactionItem tx={item} />}
          contentContainerStyle={filtered.length === 0 ? { flex: 1 } : undefined}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="No transactions yet"
              subtitle="Contributions, payouts and vault activity will show up here."
            />
          }
        />
      )}
      </View>
    </SafeAreaView>
  );
}

function EmptyState({
  icon, title, subtitle,
}: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; subtitle: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-10">
      <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center">
        <Ionicons name={icon} size={30} color="#421F6D" />
      </View>
      <Text className="text-charcoal dark:text-white font-bold text-base">{title}</Text>
      <Text className="text-muted dark:text-[#A1A1AA] text-sm text-center">{subtitle}</Text>
    </View>
  );
}
