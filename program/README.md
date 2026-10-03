# Roda Solana program

The `program/` package contains the Anchor/Rust program deployed at:

```text
5gA8XF9AuVoYkSAjMvqk7xpDDaV4Au5HGQwcEcyM9UXJ
```

It owns the source of truth for circle membership, contribution readiness, payout rotation, vault tiers, maturity checks, token transfers, and the 0.3% circle payout fee sent to `RodaConfig.admin`.

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
