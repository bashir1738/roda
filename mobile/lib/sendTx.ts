import { AnchorError } from '@anchor-lang/core';

/** Onchain RodaError variants → friendly copy. */
const RODA_MESSAGES: Record<string, string> = {
  BelowMinimum: 'Deposit is below the minimum for this vault.',
  VaultNotMatured: 'This vault is still locked — withdraw after it matures.',
  VaultNotActive: 'This vault is closed.',
  VaultAlreadyClosed: 'This vault is already closed.',
  InsufficientBalance: 'Not enough balance for this action.',
  Unauthorized: 'This wallet is not allowed to do that.',
  TransferFailed: 'Token transfer failed.',
  MathOverflow: 'Amount too large.',
  InvalidMint: 'Wrong token — Roda only uses USDC.',
  InvalidAmount: 'Amount must be greater than zero.',
  InvalidCircleName: 'Circle name must be 3-32 characters.',
  InvalidMemberCount: 'Circle must allow 2-12 members.',
  InvalidContribution: 'Contribution must match the circle amount exactly.',
  InvalidFrequency: 'Round frequency must be at least 60 seconds.',
  CircleFull: 'This circle is full.',
  CircleNotJoinable: 'This circle is not accepting members right now.',
  AlreadyPaid: 'You already paid for this round.',
  NotAllPaid: 'Waiting on other members to pay this round.',
  NotYourPayout: "It's not your turn to claim the payout.",
  CircleNotCompleted: 'The circle still has rounds to go.',
  NameTaken: 'That username is already taken.',
  NameNotSet: 'This wallet has no username yet.',
  NameTooShort: 'Username must be at least 3 characters.',
  NameTooLong: 'Username must be at most 20 characters.',
  InvalidNameChars: 'Usernames use lowercase letters, numbers and underscores.',
  CooldownActive: '24-hour cooldown active — try again later.',
  OldNameRecordRequired: 'Username change is missing the previous name account.',
  FaucetCooldown: 'Faucet already claimed today — come back tomorrow.',
};

/** Wallet / RPC / program errors → short human messages. */
export function friendlyError(error: unknown): string {
  if (!error) return 'Something went wrong.';

  if (error instanceof AnchorError) {
    const anchorErr = error as any;
    const code = anchorErr.errorCode?.code;
    if (code && RODA_MESSAGES[code]) return RODA_MESSAGES[code];
    return anchorErr.errorMessage || 'Transaction failed onchain.';
  }

  const anyErr = error as any;
  const code: string | undefined = anyErr?.errorCode?.code;
  if (code && RODA_MESSAGES[code]) return RODA_MESSAGES[code];

  const msg: string =
    anyErr?.errorMessage ??
    anyErr?.error?.message ??
    anyErr?.message ??
    String(error);

  const lower = msg.toLowerCase();
  if (lower.includes('user rejected') || lower.includes('rejected the request')) {
    return 'Request rejected in wallet.';
  }
  if (lower.includes('insufficient lamports') || lower.includes('attempt to debit an account but found no record of a prior credit')) {
    return 'Not enough SOL to pay network fees. Claim SOL from the faucet.';
  }
  if (lower.includes('blockhash not found') || lower.includes('block height exceeded')) {
    return 'Transaction expired — please try again.';
  }
  if (lower.includes('was already been used') || lower.includes('already in use')) {
    return 'That already exists — refresh and try again.';
  }
  if (lower.includes('could not find account') || lower.includes('invalid account data')) {
    return 'Account state out of date — pull to refresh.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network request failed')) {
    return 'Network error — check your connection.';
  }
  if (lower.includes('exceeded the compute budget') || lower.includes('computational budget')) {
    return 'Transaction used too much compute — try again.';
  }

  return msg.length > 160 ? `${msg.slice(0, 157)}…` : msg;
}

/** True when the user dismissed a signing prompt. */
export function isUserRejection(error: unknown): boolean {
  const msg = String((error as any)?.message ?? '').toLowerCase();
  return msg.includes('rejected') || msg.includes('cancel');
}
