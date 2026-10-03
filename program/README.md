# Roda Solana program

The `program/` package contains the Anchor/Rust program deployed at:

```text
5gA8XF9AuVoYkSAjMvqk7xpDDaV4Au5HGQwcEcyM9UXJ
```

It owns the source of truth for circle membership, contribution readiness, payout rotation, vault tiers, maturity checks, token transfers, and the 0.3% circle payout fee sent to `RodaConfig.admin`.

## Protocol invariants

- Contributions are rejected until `member_count == max_members`.
- A payout requires every member to have paid for the current round.
- A payout is rejected until `Clock::get().unix_timestamp >= round_started_ts + frequency_secs`.
- The recipient must be the member whose position matches the current round.
- All token accounts and the configured mint are checked against `RodaConfig.usdc_mint`.

## Admin and mint authority

`RodaConfig.admin` is set once during `initialize_config` to the initializing signer. The admin can later change `RodaConfig.usdc_mint` through `set_usdc_mint`, but only to an SPL mint with six decimals. Existing vaults and circles retain their stored mint and are not silently converted; operationally, the configured mint should be treated as immutable after launch. The admin also receives the 0.3% circle payout protocol fee.

The program does not grant the admin permission to move user vault or circle funds, alter circle membership, skip round timing, or claim another member's payout. The upgrade authority is a separate deployment concern controlled by the configured Anchor wallet.

## Development

Requirements: Rust, Solana CLI, and Anchor CLI.

```bash
cargo check
anchor build
anchor test
```

Run commands from this directory. Local tests require a local validator unless a configured cluster is supplied.

## Deployment

```bash
anchor deploy --provider.cluster devnet
```

The upgrade authority is the configured deployer wallet. Verify the program and cluster before deployment:

```bash
solana program show 5gA8XF9AuVoYkSAjMvqk7xpDDaV4Au5HGQwcEcyM9UXJ --url devnet
```

After building, regenerate the mobile IDL from the repository root:

```bash
node mobile/scripts/gen-idl.js
```

## Environment

```bash
cp .env.example .env
```

Never commit `DEPLOYER_PRIVATE_KEY`, wallet files, or secret API keys.

## Structure

- `programs/program/src/` — on-chain instructions, state, errors, and events
- `tests/` — Anchor integration tests
- `scripts/` — devnet setup and operational scripts
- `Anchor.toml` — cluster, wallet, and program configuration

## Tests

The Rust unit tests include the payout timing boundary. The Anchor suite also covers config mint authorization, mint decimals, circle capacity, and circle-code validation:

```bash
cargo test
anchor test
```
