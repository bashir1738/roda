import { useQuery } from '@tanstack/react-query';
import { PublicKey } from '@solana/web3.js';
import { useWallet } from '../providers/WalletContext';
import { getProgram } from '../lib/program';
import { MEMBER_OWNER_OFFSET, memberPda } from '../lib/pdas';
import { toNumber, variantIndex } from '../lib/decode';

export interface CircleData {
  /** Circle PDA address. */
  address: string;
  id: number;
  creator: string;
  name: string;
  emoji: string;
  maxMembers: number;
  memberCount: number;
  paidCount: number;
  /** Raw contribution amount (6-dec USDC). */
  contributionAmount: bigint;
  currentRound: number;
  /** Circles complete after memberCount rounds. */
  totalRounds: number;
  /** Raw treasury balance (6-dec USDC). */
  poolBalance: bigint;
  /** Unix ts when the current round closes (round start + frequency). */
  nextPayoutTimestamp: number;
  /** Round frequency in seconds. */
  frequency: number;
  /** 0 = recruiting (open), 1 = active (full/running), 2 = completed. */
  status: 0 | 1 | 2;
  /** True when everyone paid and the pot is claimable. */
  payoutPending: boolean;
  members: string[];
  /** My seat index in members (-1 if absent). */
  myPosition: number;
  /** My CircleMember paid_round (−1 = never paid). */
  myPaidRound: number;
}

/** Emoji is not stored on-chain; derive a stable one from the circle id. */
const CIRCLE_EMOJIS = ['💼', '👑', '🌿', '🎯', '🔥', '💎', '🚀', '🌟', '🏆', '💪'];
const emojiFor = (id: number) => CIRCLE_EMOJIS[id % CIRCLE_EMOJIS.length];

const PAID_NONE = 65535;

function toCircleData(acc: { publicKey: PublicKey; account: any }, myAddress?: string): CircleData | null {
  const c = acc.account;
  if (!c) return null;
  const id = toNumber(c.id);
  const maxMembers = Number(c.maxMembers);
  const memberCount = Number(c.memberCount);
  const paidCount = Number(c.paidCount);
  const members: string[] = (c.members ?? []).map((m: PublicKey) => m.toBase58());
  const poolBalance = BigInt(c.poolBalance?.toString?.() ?? 0);
  const rawStatus = variantIndex(c.status, ['active', 'completed']);
  const status: 0 | 1 | 2 = rawStatus === 1 ? 2 : memberCount < maxMembers ? 0 : 1;
  const frequency = toNumber(c.frequencySecs);
  const roundStarted = toNumber(c.roundStartedTs);
  const myPosition = myAddress ? members.indexOf(myAddress) : -1;
  let myPaidRound = -1;
  if (myPosition >= 0) {
    // paid_round is on the member record; callers with only circle data get -1
    // via useCircles which fills it below.
  }
  return {
    address: acc.publicKey.toBase58(),
    id,
    creator: c.creator.toBase58(),
    name: c.name ?? '',
    emoji: emojiFor(id),
    maxMembers,
    memberCount,
    paidCount,
    contributionAmount: BigInt(c.contributionAmount?.toString?.() ?? 0),
    currentRound: Number(c.currentRound),
    totalRounds: memberCount,
    poolBalance,
    nextPayoutTimestamp: roundStarted + frequency,
    frequency,
    status,
    payoutPending: paidCount >= memberCount && memberCount > 0 && poolBalance > 0n,
    members,
    myPosition,
    myPaidRound,
  };
}

/**
 * The circles the connected wallet belongs to (CircleMember PDAs filtered by
 * member, then the Circle accounts themselves). Circles closed on-chain are
 * dropped automatically.
 */
export function useCircles() {
  const { address } = useWallet();

  const { data, isLoading } = useQuery<CircleData[]>({
    queryKey: ['circles', address],
    enabled: !!address,
    refetchInterval: 30_000,
    queryFn: async () => {
      const program = getProgram();
      const mine = await program.account.circleMember.all([
        { memcmp: { offset: MEMBER_OWNER_OFFSET, bytes: address! } },
      ]);
      if (!mine.length) return [];
      const circleKeys = mine.map((m: any) => m.account.circle as PublicKey);
      const infos = await program.account.circle.fetchMultiple(circleKeys);

      const paidByCircle = new Map<string, number>();
      mine.forEach((m: any) => {
        const paid = Number(m.account.paidRound);
        paidByCircle.set(m.account.circle.toBase58(), paid === PAID_NONE ? -1 : paid);
      });

      const out: CircleData[] = [];
      infos.forEach((info: any, i: number) => {
        if (!info) return; // circle closed on-chain
        const fake = { publicKey: circleKeys[i], account: info } as any;
        const data = toCircleData(fake, address);
        if (data) {
          data.myPaidRound = paidByCircle.get(data.address) ?? -1;
          out.push(data);
        }
      });
      out.sort((a, b) => a.id - b.id);
      return out;
    },
  });

  return { circles: data ?? [], isLoading };
}

export interface CircleMemberInfo {
  address: string;
  paidRound: number;
  joinedRound: number;
}

/** Batch-fetch paid status for every member of a circle (single RPC). */
export function useCircleMembers(circleAddress?: string, members?: string[]) {
  const key = members?.length ? `${circleAddress}:${members.join(',')}` : null;
  return useQuery<CircleMemberInfo[]>({
    queryKey: ['circleMembers', key],
    enabled: !!key,
    staleTime: 15_000,
    queryFn: async () => {
      const program = getProgram();
      const keys = members!.map((m) => memberPda(circleAddress!, m));
      const infos = await program.account.circleMember.fetchMultiple(keys).catch(() => []);
      return infos.map((info: any, i: number) => {
        const paid = info ? Number(info.paidRound) : -1;
        return {
          address: members![i],
          paidRound: info ? (paid === PAID_NONE ? -1 : paid) : -1,
          joinedRound: info ? Number(info.joinedRound) : -1,
        };
      });
    },
  });
}
