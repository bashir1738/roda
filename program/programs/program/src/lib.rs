pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use instructions::*;
pub use state::VaultTier;

// Re-export __client_accounts_* modules at crate root for the #[program] macro.
pub(crate) use instructions::initialize_config::__client_accounts_initialize_config;
pub(crate) use instructions::create_vault::__client_accounts_create_vault;
pub(crate) use instructions::deposit::__client_accounts_deposit;
pub(crate) use instructions::withdraw::__client_accounts_withdraw;
pub(crate) use instructions::close_vault::__client_accounts_close_vault;

declare_id!("5gA8XF9AuVoYkSAjMvqk7xpDDaV4Au5HGQwcEcyM9UXJ");

#[program]
pub mod roda_vault {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>, usdc_mint: Pubkey) -> Result<()> {
        crate::instructions::initialize_config::handler(ctx, usdc_mint)
    }

    pub fn create_vault(ctx: Context<CreateVault>, tier: VaultTier) -> Result<()> {
        crate::instructions::create_vault::handler(ctx, tier)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        crate::instructions::deposit::handler(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        crate::instructions::withdraw::handler(ctx, amount)
    }

    pub fn close_vault(ctx: Context<CloseVault>) -> Result<()> {
        crate::instructions::close_vault::handler(ctx)
    }
}
