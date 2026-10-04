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

The client supports circles, USDC contributions and payouts, vault deposits/withdrawals, and the 0.3% circle payout fee implemented by the program. The Send flow supports SOL, USDC, and SKR, and accepts either a wallet address or a `.skr` name.

## Wallets and Seeker support

Magic email wallets and the local device wallet remain available as fallbacks. On a compatible Android device with a wallet such as Seed Vault, **Connect Seeker wallet** uses Mobile Wallet Adapter (MWA) to authorize and sign transactions in the native wallet.

MWA is not available in Expo Go. Use an Android development or preview build and test on a Seeker or another device with a compatible MWA wallet. The configured chain is devnet.

The official SKR mint used by Send is:

`SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3`

`.skr` resolution uses TLD House on-chain records. Unregistered names are rejected before a transaction is built, and resolved recipients show both the name and address for confirmation.

Circle invitations also accept a registered `.skr` name or a wallet address. `.skr` names are resolved to and stored as the canonical wallet address for joining. Circle member lists resolve addresses back to `.skr` names when available; wallets without a registered name continue to display a shortened address.

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
