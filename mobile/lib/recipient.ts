import { PublicKey } from '@solana/web3.js';
import { TldParserSvm } from '@onsol/tldparser';
import { getConnection } from './connection';
import { isValidAddress } from '../constants/roda';

export interface ResolvedRecipient {
  address: PublicKey;
  input: string;
  name: string | null;
}

const SKR_SUFFIX = '.skr';

export async function resolveRecipient(input: string): Promise<ResolvedRecipient> {
  const trimmed = input.trim();
  if (isValidAddress(trimmed)) {
    const parser = new TldParserSvm(getConnection());
    let name: string | null = null;
    try {
      const main = await parser.getMainDomain(trimmed);
      if (main.tld.toLowerCase() === 'skr') name = `${main.domain}${SKR_SUFFIX}`;
    } catch {
      // A wallet is valid even when it has no registered .skr name.
    }
    return { address: new PublicKey(trimmed), input: trimmed, name };
  }

  const normalized = trimmed.toLowerCase().endsWith(SKR_SUFFIX)
    ? trimmed.toLowerCase()
    : `${trimmed.toLowerCase()}${SKR_SUFFIX}`;
  if (!/^[a-z0-9-]+\.skr$/.test(normalized)) {
    throw new Error('Enter a valid Solana address or .skr name.');
  }

  const parser = new TldParserSvm(getConnection());
  const address = await parser.getOwnerFromDomainTld(normalized);
  if (!address) throw new Error(`${normalized} is not registered.`);
  return { address, input: trimmed, name: normalized };
}
