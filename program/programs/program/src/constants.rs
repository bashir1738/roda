// ─── PDA Seeds ────────────────────────────────────────────────────────────────

/// Seed for the global RodaConfig PDA.
pub const CONFIG_SEED: &[u8] = b"roda_config";

/// Seed for individual UserVault PDAs.
pub const VAULT_SEED: &[u8] = b"roda_vault";

/// Seed for the vault authority PDA (signs token transfers).
pub const VAULT_AUTHORITY_SEED: &[u8] = b"roda_vault_auth";

/// Seed for Circle PDAs (seeded by numeric circle id).
pub const CIRCLE_SEED: &[u8] = b"roda_circle";

/// Seed for the circle treasury authority PDA (signs circle token transfers).
pub const CIRCLE_AUTHORITY_SEED: &[u8] = b"roda_circle_auth";

/// Seed for per-member CircleMember PDAs.
pub const MEMBER_SEED: &[u8] = b"roda_member";

/// Seed for RegisteredName PDAs (seeded by lowercase name bytes).
pub const NAME_SEED: &[u8] = b"roda_name";

/// Seed for per-owner NameProfile PDAs.
pub const PROFILE_SEED: &[u8] = b"roda_profile";

/// Seed for the USDC faucet authority PDA (mint authority).
pub const FAUCET_SEED: &[u8] = b"roda_faucet";

/// Seed for per-user faucet cooldown records.
pub const FAUCET_INFO_SEED: &[u8] = b"roda_faucet_info";

// ─── Token Constants ──────────────────────────────────────────────────────────

use anchor_lang::prelude::Pubkey;

/// USDC decimals (6).
pub const USDC_DECIMALS: u8 = 6;

/// The only mint the built-in faucet may mint into — the Roda test USDC.
/// Never points at third-party mints (e.g. Circle's USDC): we don't hold
/// their mint authority, so minting would fail on-chain anyway.
pub const FAUCET_MINT: Pubkey =
    Pubkey::from_str_const("8DVXwvLqSjd2e73ehHajY1Ftvk2Sf96NJf8hejUQWygv");

// ─── Circle Rules ─────────────────────────────────────────────────────────────

/// Maximum members per circle.
pub const MAX_CIRCLE_MEMBERS: u8 = 12;

/// Minimum members per circle.
pub const MIN_CIRCLE_MEMBERS: u8 = 2;

/// Reserved capacity for circle names.
pub const CIRCLE_NAME_MAX: usize = 32;

/// Minimum circle name length.
pub const CIRCLE_NAME_MIN: usize = 3;

/// Minimum allowed round frequency (seconds).
pub const MIN_FREQUENCY_SECS: i64 = 60;

/// Smallest valid circle code (6 digits, no leading zero).
pub const CIRCLE_CODE_MIN: u64 = 100_000;

/// Largest valid circle code (6 digits).
pub const CIRCLE_CODE_MAX: u64 = 999_999;

/// Sentinel: member has never paid in any round.
pub const PAID_ROUND_NONE: u16 = u16::MAX;

// ─── Username Rules ───────────────────────────────────────────────────────────

/// Minimum username length.
pub const USERNAME_MIN: usize = 3;

/// Maximum username length.
pub const USERNAME_MAX: usize = 20;

/// Cooldown between username changes (seconds).
pub const NAME_COOLDOWN_SECS: i64 = 24 * 60 * 60;

/// USDC per faucet claim (6 decimals).
pub const FAUCET_AMOUNT: u64 = 1_000_000_000; // 1,000 USDC

/// Cooldown between faucet claims (seconds).
pub const FAUCET_COOLDOWN_SECS: i64 = 24 * 60 * 60;
