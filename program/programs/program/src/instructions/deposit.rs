use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::{CONFIG_SEED, VAULT_AUTHORITY_SEED, VAULT_SEED};
use crate::error::RodaError;
use crate::state::{UserVault, VaultConfig};

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, VaultConfig>,

    #[account(
        mut,
        seeds = [VAULT_SEED, owner.key().as_ref(), vault.vault_id.to_le_bytes().as_ref()],
        bump = vault.bump,
        has_one = owner @ RodaError::Unauthorized,
    )]
    pub vault: Account<'info, UserVault>,

    /// Vault authority PDA — signs token transfers.
    /// CHECK: PDA used as authority for vault token accounts.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, vault.key().as_ref()],
        bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// The USDC token mint.
    #[account(constraint = token_mint.key() == config.usdc_mint @ RodaError::TransferFailed)]
    pub token_mint: Account<'info, Mint>,

    /// User's token account (source of funds).
    #[account(
        mut,
        constraint = user_token_account.owner == owner.key() @ RodaError::Unauthorized,
        constraint = user_token_account.mint == config.usdc_mint @ RodaError::TransferFailed,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    /// Vault's ATA (destination).
    #[account(
        mut,
        constraint = vault_token_account.mint == config.usdc_mint @ RodaError::TransferFailed,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    require!(vault.active, RodaError::VaultNotActive);

    // Check tier minimum
    let min = vault.tier.min_deposit_usdc();
    require!(amount >= min, RodaError::BelowMinimum);

    // Transfer tokens from user → vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.owner.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    // Update vault state
    let now = Clock::get()?.unix_timestamp;
    vault.balance = vault
        .balance
        .checked_add(amount)
        .ok_or(RodaError::MathOverflow)?;
    vault.last_deposit_ts = now;

    let lock = vault.tier.lock_duration_secs();
    vault.maturity_ts = if lock == 0 {
        0 // Flex: no maturity
    } else {
        now.checked_add(lock).ok_or(RodaError::MathOverflow)?
    };

    Ok(())
}
