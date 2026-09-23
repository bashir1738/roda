import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProgressBar } from './ProgressBar';
import { Badge } from './Badge';
import { VAULT_TIERS, type VaultData } from '../hooks/useVaults';

function fmtUSDC(n: bigint) {
  return (Number(n) / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function timeLeft(ts: number) {
  const d = ts - Date.now() / 1000;
  if (d <= 0) return 'Matured';
  const days = Math.floor(d / 86400);
  return days === 0 ? `${Math.floor(d / 3600)}h remaining` : `${days}d remaining`;
}

function lockPct(v: VaultData) {
  if (v.lockDuration === 0) return 1;
  return Math.min(1, (Date.now() / 1000 - v.depositTimestamp) / v.lockDuration);
}

export function VaultCard({ vault, onClaim }: { vault: VaultData; onClaim: () => void }) {
  const tier = VAULT_TIERS[(['Flex', 'Growth', 'Power'] as const)[vault.tier]];
  const pct = lockPct(vault);

  // Calculate projected earnings using the same APR formula as the contract.
  // No Aave yield on Sepolia — projected earnings are estimated, not on-chain.
  const elapsed = Math.max(0, Math.floor(Date.now() / 1000) - vault.depositTimestamp);
  const projected = (vault.principalUSDC * BigInt(tier.aprBps) * BigInt(elapsed)) /
                    (BigInt(365 * 24 * 3600) * 10000n);

  return (
    <View className="bg-white dark:bg-[#121212] rounded-2xl p-5 mb-4"
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
      {/* Header */}
      <View className="flex-row justify-between items-start mb-4">
        <View className="flex-row items-center gap-3">
          <View className="w-12 h-12 rounded-2xl bg-primary/10 items-center justify-center">
            <Ionicons name={tier.icon as any} size={22} color="#421F6D" />
          </View>
          <View>
            <Text className="text-charcoal dark:text-white font-bold text-base">{tier.label} Vault</Text>
            <Text className="text-muted dark:text-[#A1A1AA] text-xs">{(tier.aprBps / 100).toFixed(1)}% APR target</Text>
          </View>
        </View>
        <Badge variant={vault.isMatured ? 'matured' : 'locked'} size="sm" />
      </View>

      {/* Amounts */}
      <View className="flex-row justify-between bg-[#F8F9FA] dark:bg-[#1C1C1E] rounded-xl p-4 mb-4 mt-1">
        <View>
          <Text className="text-muted dark:text-[#A1A1AA] text-[11px] uppercase tracking-wider mb-1">Current Balance</Text>
          <Text className="text-charcoal dark:text-white font-bold text-lg">${fmtUSDC(vault.currentBalanceUSDC)}</Text>
        </View>
        <View className="items-end">
          <Text className="text-muted dark:text-[#A1A1AA] text-[11px] uppercase tracking-wider mb-1">Projected</Text>
          <View className="flex-row items-center gap-1">
            <Ionicons name="trending-up" size={14} color="#421F6D" />
            <Text className="text-primary font-bold text-lg">+${fmtUSDC(projected)}</Text>
          </View>
        </View>
      </View>

      {/* Lock progress */}
      {vault.lockDuration > 0 && (
        <View className="gap-1.5 mb-4">
          <View className="flex-row justify-between">
            <View className="flex-row items-center gap-1">
              {vault.isMatured && <Ionicons name="checkmark" size={12} color="#16A34A" />}
              <Text className="text-muted dark:text-[#A1A1AA] text-xs">
                {vault.isMatured ? 'Matured' : timeLeft(vault.maturityTimestamp)}
              </Text>
            </View>
            <Text className="text-muted dark:text-[#A1A1AA] text-xs">{Math.round(pct * 100)}%</Text>
          </View>
          <ProgressBar progress={pct} color={vault.isMatured ? '#4ADE80' : '#FFFFFF'} />
        </View>
      )}

      {/* Claim button */}
      {vault.isMatured && !vault.claimed && (
        <TouchableOpacity
          className="bg-primary/10 rounded-xl py-3 items-center flex-row justify-center gap-2 mt-2"
          onPress={onClaim}
          accessibilityLabel={`Claim ${tier.label} vault`}
        >
          <Ionicons name="cash-outline" size={16} color="#421F6D" />
          <Text className="text-primary font-bold text-sm">
            Claim ${fmtUSDC(vault.principalUSDC)}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
