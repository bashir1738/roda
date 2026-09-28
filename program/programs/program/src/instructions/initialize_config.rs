use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

use crate::constants::{CONFIG_SEED, USDC_DECIMALS};
use crate::error::RodaError;
use crate::state::RodaConfig;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + RodaConfig::INIT_SPACE,
        seeds = [CONFIG_SEED],
        bump,
    )]
    pub config: Account<'info, RodaConfig>,

    /// The USDC mint all vaults and circles will use.
    #[account(constraint = usdc_mint.decimals == USDC_DECIMALS @ RodaError::InvalidMint)]
    pub usdc_mint: Account<'info, Mint>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeConfig>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.usdc_mint = ctx.accounts.usdc_mint.key();
    config.vault_count = 0;
    config.circle_count = 0;
    config.bump = ctx.bumps.config;
    Ok(())
}
