import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import { PROGRAM_ID } from '../constants/roda';
import { getUsdcMint } from './mint';

const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ATA_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const SYS_PROGRAM = new PublicKey('11111111111111111111111111111111');

const PROGRAM = new PublicKey(PROGRAM_ID);

type Seed = string | Uint8Array | PublicKey;

function toBuffer(seed: Seed): Buffer {
  if (typeof seed === 'string') return Buffer.from(seed);
  if (seed instanceof PublicKey) return seed.toBuffer();
  return Buffer.from(seed);
}

export function findPda(seeds: Seed[]): PublicKey {
  return PublicKey.findProgramAddressSync(seeds.map(toBuffer), PROGRAM)[0];
}

/** little-endian u64 buffer for numeric PDA seeds. */
export function u64le(value: number | bigint): Buffer {
  const buf = Buffer.alloc(8);
  new DataView(buf.buffer, buf.byteOffset, 8).setBigUint64(0, BigInt(value), true);
  return buf;
}

/** Canonical associated token address for (owner, mint) — works for off-curve owners. */
export function ataAddress(mint: PublicKey | string, owner: PublicKey | string): PublicKey {
  const mintKey = typeof mint === 'string' ? new PublicKey(mint) : mint;
  const ownerKey = typeof owner === 'string' ? new PublicKey(owner) : owner;
  return PublicKey.findProgramAddressSync(
    [ownerKey.toBuffer(), TOKEN_PROGRAM.toBuffer(), mintKey.toBuffer()],
    ATA_PROGRAM,
  )[0];
}

/** The wallet's USDC ATA. */
export const usdcAta = (owner: PublicKey | string) => ataAddress(getUsdcMint(), owner);

// ─── Config ───────────────────────────────────────────────────────────────────

export const configPda = () => findPda(['roda_config']);

// ─── Vaults ───────────────────────────────────────────────────────────────────

export const vaultPda = (owner: PublicKey | string, vaultId: number | bigint) =>
  findPda([
    'roda_vault',
    typeof owner === 'string' ? new PublicKey(owner) : owner,
    u64le(vaultId),
  ]);

export const vaultAuthority = (vault: PublicKey | string) =>
  findPda(['roda_vault_auth', typeof vault === 'string' ? new PublicKey(vault) : vault]);

export const vaultAta = (vault: PublicKey | string) => ataAddress(getUsdcMint(), vaultAuthority(vault));

// ─── Circles ──────────────────────────────────────────────────────────────────

export const circlePda = (circleId: number | bigint) => findPda(['roda_circle', u64le(circleId)]);

export const circleAuthority = (circle: PublicKey | string) =>
  findPda(['roda_circle_auth', typeof circle === 'string' ? new PublicKey(circle) : circle]);

export const circleAta = (circle: PublicKey | string) =>
  ataAddress(getUsdcMint(), circleAuthority(circle));

export const memberPda = (circle: PublicKey | string, member: PublicKey | string) =>
  findPda([
    'roda_member',
    typeof circle === 'string' ? new PublicKey(circle) : circle,
    typeof member === 'string' ? new PublicKey(member) : member,
  ]);

// ─── Usernames ────────────────────────────────────────────────────────────────

export const nameProfilePda = (owner: PublicKey | string) =>
  findPda(['roda_profile', typeof owner === 'string' ? new PublicKey(owner) : owner]);

export const registeredNamePda = (name: string) =>
  findPda(['roda_name', Buffer.from(name.toLowerCase())]);

// ─── Faucet ───────────────────────────────────────────────────────────────────

export const faucetAuthorityPda = () => findPda(['roda_faucet']);

export const faucetInfoPda = (user: PublicKey | string) =>
  findPda(['roda_faucet_info', typeof user === 'string' ? new PublicKey(user) : user]);

// ─── Account sizes for getProgramAccounts filters ─────────────────────────────

/** UserVault: 8 disc + 99 data (see program state.rs). */
export const VAULT_ACCOUNT_SIZE = 107;
/** owner field sits right after the 8-byte discriminator. */
export const VAULT_OWNER_OFFSET = 8;

/** CircleMember: 8 disc + 69 data. */
export const MEMBER_ACCOUNT_SIZE = 77;
/** member field sits after disc(8) + circle(32). */
export const MEMBER_OWNER_OFFSET = 40;
