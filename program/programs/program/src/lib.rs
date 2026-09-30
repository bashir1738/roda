pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use instructions::*;
pub use state::{CircleStatus, VaultTier};

// Re-export __client_accounts_* modules at crate root for the #[program] macro.
pub(crate) use instructions::initialize_config::__client_accounts_initialize_config;
pub(crate) use instructions::create_vault::__client_accounts_create_vault;
pub(crate) use instructions::deposit::__client_accounts_deposit;
pub(crate) use instructions::withdraw::__client_accounts_withdraw;
pub(crate) use instructions::close_vault::__client_accounts_close_vault;
pub(crate) use instructions::create_circle::__client_accounts_create_circle;
pub(crate) use instructions::join_circle::__client_accounts_join_circle;
pub(crate) use instructions::contribute::__client_accounts_contribute;
pub(crate) use instructions::claim_payout::__client_accounts_claim_payout;
pub(crate) use instructions::close_circle::__client_accounts_close_circle;
pub(crate) use instructions::claim_name::__client_accounts_claim_name;
pub(crate) use instructions::release_name::__client_accounts_release_name;
pub(crate) use instructions::request_usdc::__client_accounts_request_usdc;
pub(crate) use instructions::set_usdc_mint::__client_accounts_set_usdc_mint;

declare_id!("5gA8XF9AuVoYkSAjMvqk7xpDDaV4Au5HGQwcEcyM9UXJ");

#[program]
pub mod roda_vault {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
        crate::instructions::initialize_config::handler(ctx)
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

    pub fn create_circle(
        ctx: Context<CreateCircle>,
        circle_code: u64,
        name: String,
        max_members: u8,
        contribution_amount: u64,
        frequency_secs: i64,
    ) -> Result<()> {
        crate::instructions::create_circle::handler(
            ctx,
            circle_code,
            name,
            max_members,
            contribution_amount,
            frequency_secs,
        )
    }

    pub fn join_circle(ctx: Context<JoinCircle>, circle_id: u64) -> Result<()> {
        crate::instructions::join_circle::handler(ctx, circle_id)
    }

    pub fn contribute(ctx: Context<Contribute>, amount: u64) -> Result<()> {
        crate::instructions::contribute::handler(ctx, amount)
    }

    pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
        crate::instructions::claim_payout::handler(ctx)
    }

    pub fn close_circle(ctx: Context<CloseCircle>) -> Result<()> {
        crate::instructions::close_circle::handler(ctx)
    }

    pub fn claim_name(ctx: Context<ClaimName>, name: String) -> Result<()> {
        crate::instructions::claim_name::handler(ctx, name)
    }

    pub fn release_name(ctx: Context<ReleaseName>) -> Result<()> {
        crate::instructions::release_name::handler(ctx)
    }

    pub fn request_usdc(ctx: Context<RequestUsdc>) -> Result<()> {
        crate::instructions::request_usdc::handler(ctx)
    }

    pub fn set_usdc_mint(ctx: Context<SetUsdcMint>) -> Result<()> {
        crate::instructions::set_usdc_mint::handler(ctx)
    }
}
