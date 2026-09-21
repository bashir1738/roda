// ─── PDA Seeds ────────────────────────────────────────────────────────────────

/// Seed for the global VaultConfig PDA.
pub const CONFIG_SEED: &[u8] = b"roda_config";

/// Seed for individual UserVault PDAs.
pub const VAULT_SEED: &[u8] = b"roda_vault";

/// Seed for the vault authority PDA (signs token transfers).
pub const VAULT_AUTHORITY_SEED: &[u8] = b"roda_vault_auth";

// ─── Token Constants ──────────────────────────────────────────────────────────

/// USDC decimals (6).
pub const USDC_DECIMALS: u8 = 6;
