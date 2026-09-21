use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::{CONFIG_SEED, VAULT_AUTHORITY_SEED, VAULT_SEED};
use crate::error::RodaError;
use crate::state::{UserVault, VaultConfig};

#[derive(Accounts)]
pub struct Withdraw<'info> {
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

    /// Vault authority PDA — signs the withdrawal transfer.
    /// CHECK: PDA used as authority for vault token accounts.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, vault.key().as_ref()],
        bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// The USDC token mint.
    #[account(constraint = token_mint.key() == config.usdc_mint @ RodaError::TransferFailed)]
    pub token_mint: Account<'info, Mint>,

    /// User's token account (destination).
    #[account(
        mut,
        constraint = user_token_account.owner == owner.key() @ RodaError::Unauthorized,
        constraint = user_token_account.mint == config.usdc_mint @ RodaError::TransferFailed,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    /// Vault's ATA (source).
    #[account(
        mut,
        constraint = vault_token_account.mint == config.usdc_mint @ RodaError::TransferFailed,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    let vault = &mut ctx.accounts.vault;

    require!(vault.active, RodaError::VaultNotActive);
    require!(vault.balance >= amount, RodaError::InsufficientBalance);
    require!(amount > 0, RodaError::InsufficientBalance);

    // Enforce lock rules (Flex has lock_duration_secs == 0, so always passes)
    let lock = vault.tier.lock_duration_secs();
    if lock > 0 {
        let now = Clock::get()?.unix_timestamp;
        require!(now >= vault.maturity_ts, RodaError::VaultNotMatured);
    }

    // Transfer tokens from vault → user using PDA signer
    let seeds = &[
        VAULT_AUTHORITY_SEED,
        vault.to_account_info().key.as_ref(),
        &[ctx.bumps.vault_authority],
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.vault_token_account.to_account_info(),
        to: ctx.accounts.user_token_account.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    token::transfer(cpi_ctx, amount)?;

    vault.balance = vault
        .balance
        .checked_sub(amount)
        .ok_or(RodaError::MathOverflow)?;

    Ok(())
}
