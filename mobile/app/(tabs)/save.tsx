import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { VaultCard } from '../../components/VaultCard';
import { DepositModal } from '../../components/DepositModal';
import { PayoutSheet } from '../../components/PayoutSheet';
import { ProfileButton } from '../../components/ProfileSidebar';
import { useProfileSidebar } from '../../contexts/ProfileSidebarContext';
import { useVaults, type VaultData } from '../../hooks/useVaults';
import { useWallet } from '../../providers/WalletContext';
import { VAULT_TIERS, type VaultTier } from '../../hooks/useVaults';
import { useRefresh } from '../../hooks/useRefresh';

const TIER_KEYS: VaultTier[] = ['Flex', 'Growth', 'Power'];
const TIER_DESCS: Record<VaultTier, string> = {
  Flex:   'No lock · Min 10 USDC',
  Growth: '90-day lock · Min 100 USDC',
  Power:  '365-day lock · Min 500 USDC',
};

export default function SaveTab() {
  const { isConnected } = useWallet();
  const { vaults, isLoading } = useVaults();
  const { openSidebar } = useProfileSidebar();
  const { refreshing, refresh } = useRefresh();
  const [depositTier, setDepositTier] = useState<VaultTier | null>(null);
  const [claimVault, setClaimVault] = useState<VaultData | null>(null);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-[#121212]" edges={['top']}>
      {/* Header */}
      <View className="bg-white dark:bg-[#121212] px-5 pt-3 pb-6">
        <View className="flex-row justify-between items-start">
          <View>
            <Text className="text-charcoal dark:text-white text-4xl font-extrabold tracking-tight mt-2">Save & Earn</Text>
            <Text className="text-muted dark:text-[#A1A1AA] text-sm mt-1">Deposit any token · Earn Aave yield</Text>
          </View>
          <ProfileButton onPress={openSidebar} />
        </View>
      </View>

      <ScrollView
        className="flex-1 bg-white dark:bg-[#121212]"
        contentContainerClassName="px-4 pt-5 pb-32"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#421F6D" colors={['#421F6D']} />
        }
      >
        {/* Tier cards */}
        <View className="flex-row items-center gap-2 mb-3">
          <Ionicons name="layers-outline" size={14} color="#6B6B6B" />
          <Text className="text-muted dark:text-[#A1A1AA] text-xs font-bold uppercase tracking-wider">Choose a vault tier</Text>
        </View>

        {TIER_KEYS.map((key) => {
          const t = VAULT_TIERS[key];
          const isPopular = key === 'Growth';
          return (
            <View key={key} className="bg-white dark:bg-[#121212] rounded-2xl p-5 mb-4" style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
              {isPopular && (
                <View className="absolute top-0 right-4 bg-primary/10 px-3 py-1 rounded-b-lg">
                  <Text className="text-primary text-[11px] font-bold">Popular</Text>
                </View>
              )}
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-2xl bg-primary/10 items-center justify-center">
                  <Ionicons name={t.icon as any} size={24} color="#421F6D" />
                </View>
                <View className="flex-1">
                  <Text className="text-charcoal dark:text-white font-medium text-base">{key} Vault</Text>
                  <Text className="text-primary font-bold text-xl">{(t.aprBps / 100).toFixed(1)}% APR</Text>
                  <Text className="text-muted dark:text-[#A1A1AA] text-xs">{TIER_DESCS[key]}</Text>
                </View>
                <TouchableOpacity
                  className="bg-primary/10 px-5 py-2.5 rounded-xl"
                  onPress={() => setDepositTier(key)}
                  accessibilityLabel={`Deposit into ${key} vault`}
                >
                  <Text className="text-primary font-bold text-sm">Deposit</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {/* How it works strip */}
        <View className="bg-primary/5 rounded-2xl p-4 mb-5">
          <View className="flex-row items-center gap-2 mb-2">
            <Ionicons name="information-circle-outline" size={16} color="#421F6D" />
            <Text className="text-primary font-semibold text-sm">How it works</Text>
          </View>
          <Text className="text-muted dark:text-[#A1A1AA] text-xs leading-5">
            Your deposit is converted to USDC and supplied to Aave V3. Yield accrues automatically.
            Claim anytime (Flex) or after the lock period (Growth/Power).
          </Text>
        </View>

        {/* Active vaults */}
        {isConnected && (
          <>
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="briefcase-outline" size={14} color="#6B6B6B" />
              <Text className="text-muted dark:text-[#A1A1AA] text-xs font-bold uppercase tracking-wider">Your Active Vaults</Text>
            </View>
            {isLoading ? (
              <ActivityIndicator color="#421F6D" />
            ) : vaults.length === 0 ? (
              <View className="items-center py-8 gap-2">
                <Ionicons name="wallet-outline" size={40} color="#B8A0C8" />
                <Text className="text-muted dark:text-[#A1A1AA] text-sm">No active vaults yet</Text>
              </View>
            ) : (
              vaults.map((v) => <VaultCard key={v.id} vault={v} onClaim={() => setClaimVault(v)} />)
            )}
          </>
        )}
      </ScrollView>

      {depositTier && (
        <DepositModal tier={depositTier} visible={!!depositTier} onClose={() => setDepositTier(null)} />
      )}
      {claimVault && (
        <PayoutSheet
          target={{
            type: 'vault',
            vaultId: claimVault.id,
            availableUSDC: claimVault.currentBalanceUSDC,
            label: `${(['Flex', 'Growth', 'Power'] as const)[claimVault.tier]} Vault #${claimVault.id}`,
          }}
          visible={!!claimVault}
          onClose={() => setClaimVault(null)}
        />
      )}
    </SafeAreaView>
  );
}
