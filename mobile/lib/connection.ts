import { Connection, type Commitment } from '@solana/web3.js';
import { RPC_URL } from '../constants/roda';

const COMMITMENT: Commitment = 'confirmed';

let instance: Connection | null = null;

/** Shared Solana JSON-RPC connection (devnet by default). */
export function getConnection(): Connection {
  if (!instance) {
    instance = new Connection(RPC_URL, {
      commitment: COMMITMENT,
      confirmTransactionInitialTimeout: 60_000,
    });
  }
  return instance;
}

export const COMMITMENT_LEVEL = COMMITMENT;
