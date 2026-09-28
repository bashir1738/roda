import { BN } from '@anchor-lang/core';

/** Normalize a decoded borsh enum (`{ flex: {} }` or a number) to its index. */
export function variantIndex(value: unknown, order: string[]): number {
  if (typeof value === 'number') return value;
  const key = Object.keys((value as any) ?? {})[0] ?? '';
  const index = order.indexOf(key);
  return index >= 0 ? index : 0;
}

/** Normalize a decoded borsh enum to its variant name (lowercased). */
export function variantName(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  const key = Object.keys((value as any) ?? {})[0];
  return key ?? fallback;
}

/** BN | number | string → number (lossy for > 2^53 — fine for UI amounts). */
export function toNumber(value: any): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof BN || typeof value.toNumber === 'function') {
    try {
      return value.toNumber();
    } catch {
      return Number(value.toString());
    }
  }
  if (typeof value === 'string') return Number(value) || 0;
  return Number(value) || 0;
}

/** BN | number | string → bigint. */
export function toBigInt(value: any): bigint {
  if (typeof value === 'bigint') return value;
  if (value == null) return 0n;
  return BigInt(value.toString());
}
