# Roda

**Rotating Savings, Reimagined Onchain**

Roda is a mobile savings platform that digitalizes the traditional African rotating savings system — ajo, esusu, adashe — and combines it with individual savings vaults. No organizer. No trust required. The rules are in code.

## The Problem

Rotating savings groups have existed across Africa for generations. They break for the same reasons every time — the organizer disappears with the pot, a member stops paying with no consequence, there is no record of who paid what, and the money earns nothing while it waits. Roda fixes all of this.

## How It Works

### Circles

Create or join a rotating savings group. Every member contributes a fixed USDC amount on a set schedule. When all contributions land, the smart contract automatically releases the full pot to the next member in the queue. No admin, no manual release, no single person holding the funds.

### Vaults

Save solo between payout cycles. Deposit USDC into one of three vault tiers:

| Tier | Schedule | Minimum | Description |
|---|---|---|---|
| **Flex Solo** | No schedule | Any amount | Save at your own pace. Add funds whenever you have extra cash. Withdraw anytime. |
| **Weekly Solo** | Weekly | $10/week | Build consistency. Lock in a weekly amount to slowly build your personal pot. |
| **Monthly Solo** | Monthly | $50/month | Pay yourself first. Set aside a fixed chunk of your paycheck every month. |

### History

A full onchain record of every contribution, payout, deposit, and withdrawal — tied to your wallet address and verifiable by anyone.

## Architecture

| Package | Stack | Description |
|---|---|---|
| `program/` | Rust / Anchor 0.32.1 | Solana smart contracts — vaults, circles, token custody |
| `mobile/` | React Native / Expo | Mobile wallet and savings interface |
| `frontend/` | Next.js | Web dashboard and landing page |

## Smart Contract

**Program ID:** `5gA8XF9AuVoYkSAjMvqk7xpDDaV4Au5HGQwcEcyM9UXJ`

The onchain program implements:

- **AjoCircle** — Trustless rotating savings circles. Members contribute USDC each round; the pot is released to the current round's recipient via Uniswap V3 swaps.
- **RodaVault** — Individual savings vaults with tiered lock periods (Flex / Weekly / Monthly). Deposits are held in USDC.
- **UsernameRegistry** — Onchain display names for Roda wallets. Case-insensitive, 24h cooldown between changes.

### Build & Test

```bash
cd program
anchor build
anchor test
```

## Target Audience

Urban professionals in Nigeria and across West Africa aged 22–40 who already participate in ajo but want a version that is trustless, transparent, and puts idle savings to work.
