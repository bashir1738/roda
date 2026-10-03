# Roda

Roda is a Solana-powered rotating savings and personal vault application. Users can create or join savings circles, contribute USDC when a circle is full, receive rotating payouts, and save USDC in vaults with configurable lock periods.

## Architecture

```text
frontend/  Next.js marketing site
mobile/    Expo React Native client, wallet/auth UX, RPC and IDL integration
program/   Anchor/Rust Solana program and deployment/test scripts
```

The mobile app reads the on-chain `RodaConfig` account to resolve the configured USDC mint. Circle and vault state is enforced by the Solana program; the client only builds transactions and presents state. Circle payouts are distributed by the program, including the configured 0.3% protocol fee to the admin wallet.

## Solana deployment

- Program address: `5gA8XF9AuVoYkSAjMvqk7xpDDaV4Au5HGQwcEcyM9UXJ`
- Current development cluster: devnet
- Admin/deployer wallet: configured through `DEPLOYER_PUBKEY`; never commit its private key.

## Repository layout

See [mobile/README.md](./mobile/README.md), [program/README.md](./program/README.md), and [frontend/README.md](./frontend/README.md).

## Quick start

```bash
cp .env.example .env
cd mobile && npm install && npm run start
cd ../frontend && npm install && npm run dev
```

For program commands, use the Anchor CLI from `program/`; see its README for build, test, and deploy commands.

## Environment files

Copy the relevant `.env.example` into a local ignored env file. Never commit private keys, Magic secret keys, or production credentials.
