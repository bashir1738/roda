use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};

use crate::constants::{
    CONFIG_SEED, FAUCET_AMOUNT, FAUCET_COOLDOWN_SECS, FAUCET_INFO_SEED, FAUCET_SEED,
};
use crate::error::RodaError;
use crate::events::FaucetClaimed;
use crate::state::{FaucetInfo, RodaConfig};

#[derive(Accounts)]
pub struct RequestUsdc<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, RodaConfig>,

    /// The Roda USDC mint (must be the configured mint).
    #[account(
        mut,
        constraint = mint.key() == config.usdc_mint @ RodaError::InvalidMint,
    )]
    pub mint: Account<'info, Mint>,

    /// Faucet authority PDA — the mint's mint_authority.
    /// CHECK: signs the mint_to CPI; enforced on-chain by the token program.
    #[account(seeds = [FAUCET_SEED], bump)]
    pub faucet_authority: UncheckedAccount<'info>,

    /// Per-user cooldown record.
    #[account(
        init_if_needed,
        payer = user,
        space = FaucetInfo::SPACE,
        seeds = [FAUCET_INFO_SEED, user.key().as_ref()],
        bump,
    )]
    pub faucet_info: Account<'info, FaucetInfo>,

    /// User's USDC ATA. Created if needed.
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RequestUsdc>) -> Result<()> {
    // The faucet can only mint the Roda test USDC — refuse cleanly once the
    // config points at an external mint such as Circle's USDC.
    require_keys_eq!(
        ctx.accounts.mint.key(),
        crate::constants::FAUCET_MINT,
        RodaError::FaucetUnavailable
    );

    let now = Clock::get()?.unix_timestamp;

    if ctx.accounts.faucet_info.last_claim_ts != 0 {
        require!(
            now - ctx.accounts.faucet_info.last_claim_ts >= FAUCET_COOLDOWN_SECS,
            RodaError::FaucetCooldown
        );
    }

    let bump = ctx.bumps.faucet_authority;
    let seeds = &[FAUCET_SEED, &[bump]];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.faucet_authority.to_account_info(),
    };
    let cpi_ctx =
        CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), cpi_accounts, signer_seeds);
    token::mint_to(cpi_ctx, FAUCET_AMOUNT)?;

    let info = &mut ctx.accounts.faucet_info;
    info.user = ctx.accounts.user.key();
    info.last_claim_ts = now;
    info.bump = ctx.bumps.faucet_info;

    emit!(FaucetClaimed {
        user: info.user,
        amount: FAUCET_AMOUNT,
    });

    Ok(())
}
