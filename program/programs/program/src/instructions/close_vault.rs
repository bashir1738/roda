use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Token, TokenAccount};

use crate::constants::{CONFIG_SEED, VAULT_AUTHORITY_SEED, VAULT_SEED};
use crate::error::RodaError;
use crate::events::VaultClosed;
use crate::state::{RodaConfig, UserVault};

#[derive(Accounts)]
pub struct CloseVault<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, RodaConfig>,

    #[account(
        mut,
        seeds = [VAULT_SEED, owner.key().as_ref(), vault.vault_id.to_le_bytes().as_ref()],
        bump = vault.bump,
        has_one = owner @ RodaError::Unauthorized,
        close = owner,
    )]
    pub vault: Account<'info, UserVault>,

    /// Vault authority PDA — used to close the vault's token account.
    /// CHECK: PDA used as authority for vault token accounts.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, vault.key().as_ref()],
        bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// Vault's ATA to close — must be the vault's own ATA and empty.
    #[account(
        mut,
        constraint = vault_token_account.mint == vault.token_mint @ RodaError::InvalidMint,
        constraint = vault_token_account.owner == vault_authority.key() @ RodaError::InvalidMint,
        constraint = vault_token_account.amount == 0 @ RodaError::InsufficientBalance,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    /// Receives the rent from the closed vault token account.
    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CloseVault>) -> Result<()> {
    let vault = &ctx.accounts.vault;
    require!(vault.active, RodaError::VaultAlreadyClosed);
    require!(vault.balance == 0, RodaError::InsufficientBalance);

    // Close the vault's token account, returning rent to owner
    let seeds = &[
        VAULT_AUTHORITY_SEED,
        vault.to_account_info().key.as_ref(),
        &[ctx.bumps.vault_authority],
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = CloseAccount {
        account: ctx.accounts.vault_token_account.to_account_info(),
        destination: ctx.accounts.owner.to_account_info(),
        authority: ctx.accounts.vault_authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    token::close_account(cpi_ctx)?;

    emit!(VaultClosed {
        owner: vault.owner,
        vault_id: vault.vault_id,
    });

    Ok(())
}
