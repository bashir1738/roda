use anchor_lang::prelude::*;

use crate::constants::{CIRCLE_NAME_MAX, USERNAME_MAX};

/// Global Roda configuration — singleton PDA.
#[account]
#[derive(InitSpace)]
pub struct RodaConfig {
    /// Admin who initialized the config.
    pub admin: Pubkey,
    /// USDC token mint (SPL).
    pub usdc_mint: Pubkey,
    /// Auto-incrementing vault ID counter.
    pub vault_count: u64,
    /// Number of circles created so far (circle ids are client-generated 6-digit codes).
    pub circle_count: u64,
    /// PDA bump seed.
    pub bump: u8,
}

/// Savings vault tier.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum VaultTier {
    /// No lock, withdraw anytime, any amount.
    Flex = 0,
    /// 7-day lock per deposit, minimum 10 USDC.
    Weekly = 1,
    /// 30-day lock per deposit, minimum 50 USDC.
    Monthly = 2,
}

impl VaultTier {
    /// Minimum deposit in USDC (6 decimals).
    pub fn min_deposit_usdc(&self) -> u64 {
        match self {
            VaultTier::Flex => 0,
            VaultTier::Weekly => 10_000_000,  // 10 USDC
            VaultTier::Monthly => 50_000_000, // 50 USDC
        }
    }

    /// Lock duration in seconds (0 = no lock).
    pub fn lock_duration_secs(&self) -> i64 {
        match self {
            VaultTier::Flex => 0,
            VaultTier::Weekly => 7 * 24 * 60 * 60,  // 7 days
            VaultTier::Monthly => 30 * 24 * 60 * 60, // 30 days
        }
    }
}

/// Individual user savings vault.
#[account]
#[derive(InitSpace)]
pub struct UserVault {
    /// The owner of this vault.
    pub owner: Pubkey,
    /// Unique vault ID (from RodaConfig.vault_count).
    pub vault_id: u64,
    /// Vault tier.
    pub tier: VaultTier,
    /// Token mint held in this vault (USDC).
    pub token_mint: Pubkey,
    /// Total deposited amount (in token decimals).
    pub balance: u64,
    /// Timestamp of the last deposit (governs maturity).
    pub last_deposit_ts: i64,
    /// Timestamp when the vault matures (last_deposit_ts + lock_duration).
    pub maturity_ts: i64,
    /// Whether the vault is active (can receive deposits).
    pub active: bool,
    /// PDA bump seed.
    pub bump: u8,
}

/// Lifecycle state of a rotating savings circle.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum CircleStatus {
    /// Accepting contributions / claims.
    Active = 0,
    /// All rounds paid out.
    Completed = 1,
}

/// Rotating savings (ajo/esusu) circle.
#[account]
pub struct Circle {
    /// Stable numeric ID (join-by-id, display).
    pub id: u64,
    /// Wallet that created the circle.
    pub creator: Pubkey,
    /// Display name (3-32 chars, reserved capacity).
    pub name: String,
    /// Maximum members allowed.
    pub max_members: u8,
    /// Current number of joined members.
    pub member_count: u8,
    /// Members who paid for the current round.
    pub paid_count: u8,
    /// Fixed contribution per member per round (USDC, 6 decimals).
    pub contribution_amount: u64,
    /// Seconds between rounds (informational schedule).
    pub frequency_secs: i64,
    /// Round currently collecting contributions (0-based).
    pub current_round: u16,
    /// USDC held in the circle treasury for the current round.
    pub pool_balance: u64,
    /// Unix timestamp when the current round started.
    pub round_started_ts: i64,
    /// Active until all rounds complete.
    pub status: CircleStatus,
    /// Member wallets in join order; payout for round R goes to members[R % member_count].
    pub members: Vec<Pubkey>,
    /// PDA bump seed.
    pub bump: u8,
}

impl Circle {
    /// Total account size (discriminator + fixed fields + dynamic name/members).
    pub fn space(max_members: u8) -> usize {
        8                              // discriminator
            + 8                         // id
            + 32                        // creator
            + 4 + CIRCLE_NAME_MAX       // name (String header + reserved)
            + 1                         // max_members
            + 1                         // member_count
            + 1                         // paid_count
            + 8                         // contribution_amount
            + 8                         // frequency_secs
            + 2                         // current_round
            + 8                         // pool_balance
            + 8                         // round_started_ts
            + 1                         // status
            + 4 + 32 * max_members as usize // members (Vec header + reserved)
            + 1                         // bump
    }
}

/// Per-member position inside a circle.
#[account]
pub struct CircleMember {
    /// Circle this membership belongs to.
    pub circle: Pubkey,
    /// Member wallet.
    pub member: Pubkey,
    /// Round in which the member joined.
    pub joined_round: u16,
    /// Round the member last paid for (PAID_ROUND_NONE = never).
    pub paid_round: u16,
    /// PDA bump seed.
    pub bump: u8,
}

impl CircleMember {
    /// 8 disc + 32 circle + 32 member + 2 joined_round + 2 paid_round + 1 bump
    pub const SPACE: usize = 77;
}

/// Per-owner username profile (reverse lookup + cooldown bookkeeping).
#[account]
pub struct NameProfile {
    /// Wallet that owns the username.
    pub owner: Pubkey,
    /// Current lowercase username ("" when released).
    pub name: String,
    /// Unix timestamp of the last claim/release (cooldown gate).
    pub last_change_ts: i64,
    /// PDA bump seed.
    pub bump: u8,
}

impl NameProfile {
    /// 8 disc + 32 owner + 4 header + reserved name + 8 last_change_ts + 1 bump
    pub const SPACE: usize = 8 + 32 + 4 + USERNAME_MAX + 8 + 1;
}

/// Onchain username registration (name → owner).
#[account]
pub struct RegisteredName {
    /// Wallet that owns this name.
    pub owner: Pubkey,
    /// The registered lowercase username.
    pub name: String,
    /// Unix timestamp when claimed.
    pub claimed_at: i64,
    /// PDA bump seed.
    pub bump: u8,
}

impl RegisteredName {
    /// 8 disc + 32 owner + 4 header + reserved name + 8 claimed_at + 1 bump
    pub const SPACE: usize = 8 + 32 + 4 + USERNAME_MAX + 8 + 1;
}

/// Per-user faucet cooldown record.
#[account]
pub struct FaucetInfo {
    /// Wallet that claimed.
    pub user: Pubkey,
    /// Unix timestamp of the last claim (0 = never).
    pub last_claim_ts: i64,
    /// PDA bump seed.
    pub bump: u8,
}

impl FaucetInfo {
    /// 8 disc + 32 user + 8 last_claim_ts + 1 bump
    pub const SPACE: usize = 49;
}
