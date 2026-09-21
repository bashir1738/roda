use anchor_lang::prelude::*;

/// Global vault configuration — singleton PDA.
#[account]
#[derive(InitSpace)]
pub struct VaultConfig {
    /// Admin who can update config.
    pub admin: Pubkey,
    /// USDC token mint (SPL).
    pub usdc_mint: Pubkey,
    /// Auto-incrementing vault ID counter.
    pub vault_count: u64,
    /// PDA bump seed.
    pub bump: u8,
}

/// Savings vault tier.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
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
            VaultTier::Weekly => 10_000_000,   // 10 USDC
            VaultTier::Monthly => 50_000_000,  // 50 USDC
        }
    }

    /// Lock duration in seconds (0 = no lock).
    pub fn lock_duration_secs(&self) -> i64 {
        match self {
            VaultTier::Flex => 0,
            VaultTier::Weekly => 7 * 24 * 60 * 60,    // 7 days
            VaultTier::Monthly => 30 * 24 * 60 * 60,   // 30 days
        }
    }
}

/// Individual user savings vault.
#[account]
#[derive(InitSpace)]
pub struct UserVault {
    /// The owner of this vault.
    pub owner: Pubkey,
    /// Unique vault ID (from VaultConfig.vault_count).
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
