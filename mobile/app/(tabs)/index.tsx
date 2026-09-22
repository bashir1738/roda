import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { WalletButton } from '../../components/WalletButton';
import { CircleCard } from '../../components/CircleCard';
import { CircleDetail } from '../../components/CircleDetail';
import { ProfileButton } from '../../components/ProfileSidebar';
import { useProfileSidebar } from '../../contexts/ProfileSidebarContext';
import { useCircles, type CircleData } from '../../hooks/useCircles';
import { useWallet } from '../../providers/WalletContext';
import { useRefresh } from '../../hooks/useRefresh';
import { useFundWallet } from '../../hooks/useFundWallet';

function fmtUSDC(n: bigint) {
  return (Number(n) / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

export default function HomeTab() {
  const router = useRouter();
  const { isConnected, connect, address } = useWallet();
  const { circles, isLoading } = useCircles();
  const { openSidebar } = useProfileSidebar();
  const { refreshing, refresh } = useRefresh();
  const [selected, setSelected] = React.useState<CircleData | null>(null);
  const [balanceHidden, setBalanceHidden] = React.useState(false);

  // Auto-fund wallet if balance is low
  useFundWallet(address);


  const totalSaved = circles.reduce((s, c) => s + c.poolBalance, 0n);
  const pendingPayouts = circles.filter((c) => c.payoutPending && c.myPosition === c.currentRound);
  const activeCount = circles.filter((c) => c.status === 1).length;


  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-[#121212]" edges={['top']}>
      {/* ── Top bar ── */}
      <View className="flex-row items-center justify-between px-5 pt-3 pb-1">
        <TouchableOpacity className="flex-row items-center gap-2.5" onPress={openSidebar}>
          <View className="w-11 h-11 rounded-full bg-primary/10 items-center justify-center">
            <Text className="text-primary font-bold text-base">A</Text>
          </View>
          <Text className="text-charcoal dark:text-white font-bold text-base">Hi, Amara</Text>
        </TouchableOpacity>
        <View className="flex-row items-center gap-3">
          <WalletButton />
          <View className="bg-border-subtle/50 dark:bg-white/10 px-3 py-1.5 rounded-lg">
            <Text className="text-charcoal dark:text-white font-bold text-xs">Tier 3</Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-32"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#421F6D" colors={['#421F6D']} />
        }
      >
        {/* ── Balance Section ── */}
        <View className="px-5 pt-8">
          <Text className="text-muted dark:text-[#A1A1AA] font-bold text-xs uppercase tracking-wider mb-0.5">Total Balance</Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-charcoal dark:text-white text-4xl font-extrabold tracking-tight">
              {balanceHidden ? '••••••' : `$${fmtUSDC(totalSaved)}`}
            </Text>
            <TouchableOpacity onPress={() => setBalanceHidden((h) => !h)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name={balanceHidden ? 'eye-off-outline' : 'eye-outline'} size={18} color="#6B6B6B" />
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View className="flex-row justify-between gap-3 mt-7">
            <TouchableOpacity className="flex-1 items-center gap-1.5" onPress={() => router.push('/(tabs)/save')}>
              <View className="w-full h-14 rounded-xl bg-primary/10 items-center justify-center">
                <Ionicons name="trending-up" size={24} color="#421F6D" />
              </View>
              <Text className="text-charcoal dark:text-white font-semibold text-[13px]">Add Money</Text>
            </TouchableOpacity>
            
            <TouchableOpacity className="flex-1 items-center gap-1.5" onPress={() => router.push('/(tabs)/wallet')}>
              <View className="w-full h-14 rounded-xl bg-border-subtle/50 dark:bg-white/10 items-center justify-center">
                <Ionicons name="wallet-outline" size={24} color="#16141a" />
              </View>
              <Text className="text-charcoal dark:text-white font-semibold text-[13px]">Transfer</Text>
            </TouchableOpacity>

            <TouchableOpacity className="flex-1 items-center gap-1.5" onPress={() => router.push('/(tabs)/circles')}>
              <View className="w-full h-14 rounded-xl bg-border-subtle/50 dark:bg-white/10 items-center justify-center">
                <Ionicons name="people-outline" size={24} color="#16141a" />
              </View>
              <Text className="text-charcoal dark:text-white font-semibold text-[13px]">Circles</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Recent Activity / Circles ── */}
        <View className="px-5 mt-9 flex-1">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-charcoal dark:text-white text-base font-bold">Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/circles')}>
              <Text className="text-primary font-bold text-sm">See All</Text>
            </TouchableOpacity>
          </View>

          {/* Payout alert */}
          {pendingPayouts.length > 0 && (
            <TouchableOpacity
              className="flex-row items-center justify-between mb-5"
              onPress={() => setSelected(pendingPayouts[0])}
            >
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-full bg-[#4ADE80]/15 items-center justify-center">
                  <Ionicons name="gift" size={20} color="#22c55e" />
                </View>
                <View>
                  <Text className="text-charcoal dark:text-white font-bold text-base">{pendingPayouts[0].name}</Text>
                  <Text className="text-muted dark:text-[#A1A1AA] text-[13px]">Payout ready to claim</Text>
                </View>
              </View>
              <Text className="text-[#22c55e] font-extrabold text-base">+$${fmtUSDC(pendingPayouts[0].poolBalance)}</Text>
            </TouchableOpacity>
          )}

          {!isConnected ? (
            <View className="items-center py-10 gap-3">
              <View className="w-12 h-14 rounded-full bg-primary/10 items-center justify-center">
                <Ionicons name="log-in-outline" size={24} color="#421F6D" />
              </View>
              <Text className="text-charcoal dark:text-white font-bold text-sm">Sign in to get started</Text>
              <TouchableOpacity className="bg-primary rounded-full px-6 py-2.5 mt-1" onPress={connect}>
                <Text className="text-white font-bold text-xs">Sign in</Text>
              </TouchableOpacity>
            </View>
          ) : isLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator color="#421F6D" />
            </View>
          ) : circles.length === 0 ? (
            <View className="items-center py-10 gap-3">
              <Text className="text-muted dark:text-[#A1A1AA] text-xs text-center">No recent activity.</Text>
            </View>
          ) : (
            <View className="flex-col gap-5">
              {[...circles]
                .sort((a, b) => Number(b.id - a.id))
                .slice(0, 5) // Show only latest 5 in recent activity
                .map((c) => (
                  <TouchableOpacity 
                    key={c.id} 
                    className="flex-row items-center justify-between"
                    onPress={() => setSelected(c)}
                  >
                    <View className="flex-row items-center gap-3">
                      <View className="w-12 h-12 rounded-full bg-border-subtle/50 dark:bg-white/10 items-center justify-center">
                        <Ionicons name="people" size={20} color="#16141a" />
                      </View>
                      <View>
                        <Text className="text-charcoal dark:text-white font-bold text-base">{c.name}</Text>
                        <Text className="text-muted dark:text-[#A1A1AA] text-[13px]">Weekly contribution</Text>
                      </View>
                    </View>
                    <Text className="text-charcoal dark:text-white font-bold text-base">-$${fmtUSDC(c.contributionAmount)}</Text>
                  </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {selected && (
        <CircleDetail circle={selected} visible={!!selected} onClose={() => setSelected(null)} />
      )}
    </SafeAreaView>
  );
}

function StatChip({
  icon, value, label, tint,
}: { icon: React.ComponentProps<typeof Ionicons>['name']; value: number; label: string; tint: string }) {
  return (
    <View className="flex-row items-center gap-1.5 bg-white dark:bg-[#121212]/10 rounded-full px-3 py-1.5 border border-white/10">
      <Ionicons name={icon} size={11} color={tint} />
      <Text className="text-white font-bold text-xs">{value}</Text>
      <Text className="text-white/50 text-xs">{label}</Text>
    </View>
  );
}
