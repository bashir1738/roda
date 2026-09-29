use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::constants::{CONFIG_SEED, USDC_DECIMALS};
use crate::error::RodaError;
use crate::state::RodaConfig;

/// Point the global config at a new USDC mint (admin only).
#[derive(Accounts)]
pub struct SetUsdcMint<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, RodaConfig>,

    /// The new USDC mint (6 decimals).
    #[account(constraint = usdc_mint.decimals == USDC_DECIMALS @ RodaError::InvalidMint)]
    pub usdc_mint: Account<'info, Mint>,

    /// Config admin — the wallet that ran initialize_config.
    #[account(constraint = admin.key() == config.admin @ RodaError::Unauthorized)]
    pub admin: Signer<'info>,
}

pub fn handler(ctx: Context<SetUsdcMint>) -> Result<()> {
    ctx.accounts.config.usdc_mint = ctx.accounts.usdc_mint.key();
    Ok(())
}
