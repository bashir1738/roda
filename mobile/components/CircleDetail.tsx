import React, { useState } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReadContract } from 'wagmi';
import { AjoPot } from './AjoPot';
import { TxStateView } from './TxStateView';
import { InviteModal } from './InviteModal';
import { useContribute } from '../hooks/useContribute';
import { useClaim } from '../hooks/useClaim';
import { useWallet } from '../providers/WalletContext';
import { TOKEN_ADDRESSES, CONTRACT_ADDRESSES } from '../constants/addresses';
import { AJO_CIRCLE_ABI } from '../constants/abis';
import type { CircleData } from '../hooks/useCircles';

function fmtAddr(addr: string) { return `${addr.slice(0, 6)}…${addr.slice(-4)}`; }
function fmtUSDC(n: bigint) {
  return (Number(n) / 1_000_000).toLocaleString('en-US', { minimumFractionDigits: 0 });
}

function MemberRow({ addr, position, isNext, isMe, circleId }: {
  addr: string; position: number; isNext: boolean; isMe: boolean;
  circleId: number; currentRound: number;
}) {
  const { data: hasPaidData } = useReadContract({
    address: CONTRACT_ADDRESSES.AJO_CIRCLE,
    abi: AJO_CIRCLE_ABI,
    functionName: 'hasPaid',
    args: [BigInt(circleId), addr as `0x${string}`],
  });

  const label = isMe ? `${fmtAddr(addr)} (You)` : fmtAddr(addr);
  const hasPaid = hasPaidData === true;

  return (
    <View className="flex-row items-center gap-3 py-3 border-b border-border dark:border-white/10">
      <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
        <Text className="text-primary text-sm font-bold">{position}</Text>
      </View>
      <View className="flex-1">
        <Text

          className={`text-sm font-semibold font-mono ${isMe ? 'text-primary' : 'text-charcoal dark:text-white'}`}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        {hasPaid && (
          <View className="bg-green-100 dark:bg-green-900/30 rounded-lg px-2 py-1">
            <Ionicons name="checkmark" size={14} color="#16A34A" />
          </View>
        )}
        {isNext && (
          <View className="flex-row items-center gap-1 bg-accent px-2 py-0.5 rounded-lg">
            <Ionicons name="star" size={10} color="#421F6D" />
            <Text className="text-primary text-[11px] font-bold">Next</Text>
          </View>
        )}
      </View>
    </View>
  );
}

export function CircleDetail({ circle, visible, onClose }: {
  circle: CircleData; visible: boolean; onClose: () => void;
}) {
  const { address } = useWallet();
  const contribute = useContribute();
  const claim = useClaim();
  const [showInvite, setShowInvite] = useState(false);

  const fillPercent = circle.totalRounds > 0 ? (circle.currentRound / circle.totalRounds) * 100 : 0;
  const isRecipient = circle.payoutPending && circle.myPosition === circle.currentRound;
  const canContribute = circle.status === 1 && !circle.payoutPending && circle.myPosition > 0;
  const isCreator = circle.members[0]?.toLowerCase() === address?.toLowerCase();
  const canInvite = isCreator && circle.status === 0 && circle.members.length < circle.maxMembers;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-white dark:bg-[#121212]">
        {/* Drag handle */}
        <View className="w-9 h-1 rounded-full bg-border self-center mt-3 mb-4" />

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View className="items-center px-6 pb-5">
            <Text className="text-charcoal dark:text-white text-xl font-black text-center">{circle.name}</Text>
            <Text className="text-muted dark:text-[#A1A1AA] text-sm mt-1">
              {circle.members.length} members · Round {circle.currentRound}/{circle.totalRounds}
            </Text>
          </View>

          {/* Pot */}
          <View className="items-center py-5 bg-primary/5 rounded-2xl mx-4 mb-4">
            <AjoPot fillPercent={fillPercent} size={90} />
            <Text className="text-muted dark:text-[#A1A1AA] text-xs mt-2">{Math.round(fillPercent)}% funded this round</Text>
          </View>

          {/* Stats */}
          <View className="flex-row bg-white dark:bg-[#121212] border border-border dark:border-white/10 mx-4 rounded-2xl p-4 mb-4">
            {[
              { label: 'Pool Balance', value: `$${fmtUSDC(circle.poolBalance)}` },
              { label: 'Your Position', value: `#${circle.myPosition || '–'}` },
              { label: 'Next Payout', value: circle.nextPayoutTimestamp ? new Date(circle.nextPayoutTimestamp * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'On activation' },
            ].map((s, i) => (
              <React.Fragment key={i}>
                {i > 0 && <View className="w-px bg-border dark:bg-white/10" />}
                <View className="flex-1 items-center">
                  <Text className="text-charcoal dark:text-white font-bold text-base">{s.value}</Text>
                  <Text className="text-muted dark:text-[#A1A1AA] text-[11px] mt-1">{s.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>

          {/* Members */}
          <View className="px-4 mb-4">
            <Text className="text-muted dark:text-[#A1A1AA] text-xs font-bold uppercase tracking-wider mb-2">
              Members & Queue
            </Text>
            {circle.members.map((m, i) => (
              <MemberRow
                key={m}
                addr={m}
                position={i + 1}
                isNext={i + 1 === circle.currentRound && circle.payoutPending}
                isMe={m.toLowerCase() === address?.toLowerCase()}
                circleId={circle.id}
                currentRound={circle.currentRound}
              />
            ))}
          </View>

          {/* Tx states */}
          {contribute.txState !== 'idle' && (
            <TxStateView txState={contribute.txState} txHash={contribute.txHash}
              error={contribute.error} successMessage="Contribution confirmed! 🎉"
              onReset={contribute.reset} />
          )}
          {claim.txState !== 'idle' && (
            <TxStateView txState={claim.txState} txHash={claim.txHash}
              error={claim.error} successMessage="Payout claimed! 💰"
              onReset={claim.reset} />
          )}
        </ScrollView>

        {/* Footer */}
        <View className="px-4 pb-6 pt-3 border-t border-border dark:border-white/10 bg-white dark:bg-[#121212] gap-3">
          {canInvite && (
            <TouchableOpacity
              className="bg-primary/10 border border-primary/20 rounded-xl py-3.5 items-center flex-row justify-center gap-2 mt-1"
              onPress={() => setShowInvite(true)}
              accessibilityLabel="Invite members"
            >
              <Ionicons name="person-add-outline" size={17} color="#421F6D" />
              <Text className="text-primary font-bold">Invite Members</Text>
            </TouchableOpacity>
          )}
          {isRecipient && claim.txState === 'idle' && (
            <TouchableOpacity
              className="bg-primary/10 rounded-xl py-4 items-center flex-row justify-center gap-2 mt-1"
              onPress={() => claim.claim({
                type: 'circle', circleId: circle.id, tokenOut: TOKEN_ADDRESSES.USDC,
                amountOutMinimum: circle.poolBalance * 99n / 100n, poolFee: 3000,
              })}
              accessibilityLabel="Claim payout"
            >
              <Ionicons name="cash" size={18} color="white" />
              <Text className="text-white font-bold text-base">
                🎉 Claim ${fmtUSDC(circle.poolBalance)} USDC
              </Text>
            </TouchableOpacity>
          )}
          {canContribute && contribute.txState === 'idle' && (
            <TouchableOpacity
              className="bg-primary/10 rounded-xl py-4 items-center flex-row justify-center gap-2 mt-1"
              onPress={() => contribute.contribute({
                circleId: circle.id, tokenIn: TOKEN_ADDRESSES.USDC,
                amountIn: circle.contributionAmount,
                amountOutMinimum: circle.contributionAmount, poolFee: 3000,
              })}
              accessibilityLabel="Contribute"
            >
              <Ionicons name="arrow-up-circle" size={18} color="white" />
              <Text className="text-white font-bold text-base">
                Contribute ${fmtUSDC(circle.contributionAmount)} USDC
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            className="border border-border rounded-full py-3.5 items-center"
            onPress={onClose}
            accessibilityLabel="Close"
          >
            <Text className="text-charcoal dark:text-white font-semibold">Close</Text>
          </TouchableOpacity>
        </View>
      </View>

      <InviteModal visible={showInvite} circle={circle} onClose={() => setShowInvite(false)} />
    </Modal>
  );
}
