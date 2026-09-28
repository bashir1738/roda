import { useState, useEffect, useCallback } from 'react';
import { PublicKey } from '@solana/web3.js';
import { getConnection } from '../lib/connection';
import { getProgram } from '../lib/program';
import { toBigInt, toNumber } from '../lib/decode';
import type { Transaction, TxType } from '../components/TransactionItem';

const MAX_TXS = 40;

interface DecodedEvent {
  name: string;
  data: any;
}

function mapEvent(
  e: DecodedEvent,
  signature: string,
  date: Date
): Transaction | null {
  const d = e.data ?? {};
  const base = { date, txHash: signature };

  switch (e.name) {
    case 'CircleCreated':
      return {
        ...base,
        id: `created-${signature}`,
        type: 'circle_create',
        label: `Created circle: ${d.name ?? '?'}`,
        subLabel: `Circle #${toNumber(d.circleId)}`,
        amountUSDC: 0n,
      };
    case 'MemberJoined':
      return {
        ...base,
        id: `joined-${signature}`,
        type: 'circle_join',
        label: 'Joined circle',
        subLabel: `Circle #${toNumber(d.circleId)}`,
        amountUSDC: 0n,
      };
    case 'ContributionMade':
      return {
        ...base,
        id: `contrib-${signature}`,
        type: 'contribution',
        label: 'Circle contribution',
        subLabel: `Circle #${toNumber(d.circleId)}`,
        amountUSDC: toBigInt(d.amount),
      };
    case 'PayoutReleased':
      return {
        ...base,
        id: `payout-${signature}`,
        type: 'payout',
        label: 'Circle payout',
        subLabel: `Circle #${toNumber(d.circleId)}`,
        amountUSDC: toBigInt(d.amount),
      };
    case 'VaultCreated':
      return {
        ...base,
        id: `vault-created-${signature}`,
        type: 'deposit',
        label: 'Vault opened',
        subLabel: `Vault #${toNumber(d.vaultId)}`,
        amountUSDC: 0n,
      };
    case 'VaultDeposit':
      return {
        ...base,
        id: `deposit-${signature}`,
        type: 'deposit',
        label: 'Vault deposit',
        subLabel: `Vault #${toNumber(d.vaultId)}`,
        amountUSDC: toBigInt(d.amount),
      };
    case 'VaultWithdraw':
      return {
        ...base,
        id: `withdraw-${signature}`,
        type: 'claim',
        label: 'Vault withdrawal',
        subLabel: `Vault #${toNumber(d.vaultId)}`,
        amountUSDC: toBigInt(d.amount),
      };
    case 'VaultClosed':
      return {
        ...base,
        id: `vault-closed-${signature}`,
        type: 'claim',
        label: 'Vault closed',
        subLabel: `Vault #${toNumber(d.vaultId)}`,
        amountUSDC: 0n,
      };
    case 'FaucetClaimed':
      return {
        ...base,
        id: `faucet-${signature}`,
        type: 'faucet',
        label: 'USDC faucet claim',
        subLabel: 'Devnet faucet',
        amountUSDC: toBigInt(d.amount),
      };
    default:
      return null;
  }
}

/**
 * Recent on-chain activity for the wallet: signatures → transactions →
 * decoded Anchor events.
 */
export function useTransactionHistory(address: string | undefined) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!address) {
      setTxs([]);
      return;
    }
    setIsLoading(true);
    try {
      const connection = getConnection();
      const program = getProgram();
      const owner = new PublicKey(address);

      const signatures = await connection.getSignaturesForAddress(owner, {
        limit: MAX_TXS,
      });
      const recent = signatures.filter((s) => !s.err);
      if (!recent.length) {
        setTxs([]);
        return;
      }

      const transactions = await Promise.all(
        recent.map((s) =>
          connection
            .getTransaction(s.signature, {
              maxSupportedTransactionVersion: 0,
              commitment: 'confirmed',
            })
            .catch(() => null)
        )
      );

      const rows: Transaction[] = [];
      const seen = new Set<string>();
      const createdCircleTxs = new Set<string>();

      transactions.forEach((tx, i) => {
        if (!tx?.meta) return;
        const signature = recent[i].signature;
        const date = tx.blockTime ? new Date(tx.blockTime * 1000) : new Date();
        const logs = tx.meta.logMessages ?? [];

        const events: DecodedEvent[] = [];
        for (const line of logs) {
          if (line.startsWith('Program data: ')) {
            try {
              const decoded = program.coder.events.decode(
                line.slice('Program data: '.length)
              );
              if (decoded) events.push(decoded as DecodedEvent);
            } catch {
              // Not an event from our program — skip.
            }
          }
        }

        for (const e of events) {
          if (e.name === 'CircleCreated') createdCircleTxs.add(signature);
        }
        for (const e of events) {
          // MemberJoined also fires from createCircle — skip the duplicate.
          if (e.name === 'MemberJoined' && createdCircleTxs.has(signature)) continue;
          const row = mapEvent(e, signature, date);
          if (row && !seen.has(row.id)) {
            seen.add(row.id);
            rows.push(row);
          }
        }
      });

      rows.sort((a, b) => b.date.getTime() - a.date.getTime());
      setTxs(rows);
    } catch (e) {
      if (__DEV__) console.warn('[txHistory]', e);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { txs, isLoading, refresh: fetch };
}
