# Roda mobile

The `mobile/` package is an Expo React Native client for Roda. It handles authentication, wallet connection, dark/light UI, Solana RPC reads, and transaction signing through the generated Anchor IDL.

## Development

```bash
npm install
npm run start
```

Use `npm run android`, `npm run ios`, or `npm run web` for a platform-specific launch.

## Solana program

- Program address: `5gA8XF9AuVoYkSAjMvqk7xpDDaV4Au5HGQwcEcyM9UXJ`
- Default cluster: devnet
- The app reads configured mint/admin values from the on-chain `RodaConfig`.

The client supports circles, USDC contributions and payouts, vault deposits/withdrawals, and the 0.3% circle payout fee implemented by the program.

## Environment

```bash
cp .env.example .env.local
```

`EXPO_PUBLIC_*` values are bundled into the app and must be public. Keep Magic secret keys and deployer private keys outside this folder.

## Structure

- `app/` — Expo Router screens
- `components/` — reusable UI
- `hooks/` — query and transaction hooks
- `lib/` — RPC, PDA, token, and transaction helpers
- `constants/idl.ts` — generated Anchor IDL

## IDL refresh

After `anchor build` from `program/`, regenerate the client IDL:

```bash
node scripts/gen-idl.js
```
