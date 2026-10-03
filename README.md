# Roda

Roda is a Solana-powered rotating savings and personal vault application. Users can create or join savings circles, contribute USDC when a circle is full, receive rotating payouts, and save USDC in vaults with configurable lock periods.

## Architecture

```text
frontend/  Next.js marketing site
mobile/    Expo React Native client, wallet/auth UX, RPC and IDL integration
program/   Anchor/Rust Solana program and deployment/test scripts
```

The mobile app reads the on-chain `RodaConfig` account to resolve the configured USDC mint. Circle and vault state is enforced by the Solana program; the client only builds transactions and presents state. Circle payouts are distributed by the program, including the configured 0.3% protocol fee to the admin wallet.

Circle payouts are time-gated on-chain: all members must pay, the round recipient must sign, and the configured frequency must have elapsed since the round start. The app's countdown is presentation only and is never trusted for authorization.

## Solana deployment

- Program address: `5gA8XF9AuVoYkSAjMvqk7xpDDaV4Au5HGQwcEcyM9UXJ`
- Current development cluster: devnet
- Admin/deployer wallet: configured through `DEPLOYER_PUBKEY`; never commit its private key.

The config admin can update the six-decimal USDC mint and receives the 0.3% payout fee, but cannot bypass circle membership, recipient, contribution, or timing checks. Keep the configured mint operationally stable after launch because existing accounts store their mint association.

## Submission demo

For the technical demo, run the protocol smoke flow from [program/](./program/):

```bash
cd program
node scripts/smoke-devnet.js
```

Show the circle PDA and treasury PDA, the member and paid counts after contributions, the rejected wrong-recipient claim, the frequency wait, the successful payout, and the 0.3% admin fee transfer. This makes the on-chain invariants visible instead of spending the demo on onboarding screens.

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
