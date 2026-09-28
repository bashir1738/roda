use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::{CONFIG_SEED, VAULT_AUTHORITY_SEED, VAULT_SEED};
use crate::error::RodaError;
use crate::events::VaultCreated;
use crate::state::{RodaConfig, UserVault, VaultTier};

#[derive(Accounts)]
pub struct CreateVault<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, RodaConfig>,

    #[account(
        init,
        payer = owner,
        space = 8 + UserVault::INIT_SPACE,
        seeds = [VAULT_SEED, owner.key().as_ref(), config.vault_count.to_le_bytes().as_ref()],
        bump,
    )]
    pub vault: Account<'info, UserVault>,

    /// The USDC token mint.
    #[account(constraint = token_mint.key() == config.usdc_mint @ RodaError::InvalidMint)]
    pub token_mint: Account<'info, Mint>,

    /// Vault authority PDA — used to sign token transfers on behalf of the vault.
    /// CHECK: PDA used as authority for vault token accounts.
    #[account(
        seeds = [VAULT_AUTHORITY_SEED, vault.key().as_ref()],
        bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    /// Vault's ATA for the token mint. Created if needed.
    #[account(
        init_if_needed,
        payer = owner,
        associated_token::mint = token_mint,
        associated_token::authority = vault_authority,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<CreateVault>, tier: VaultTier) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let vault = &mut ctx.accounts.vault;

    vault.owner = ctx.accounts.owner.key();
    vault.vault_id = config.vault_count;
    vault.tier = tier;
    vault.token_mint = config.usdc_mint;
    vault.balance = 0;
    vault.last_deposit_ts = 0;
    vault.maturity_ts = 0;
    vault.active = true;
    vault.bump = ctx.bumps.vault;

    let vault_id = config.vault_count;
    config.vault_count = config
        .vault_count
        .checked_add(1)
        .ok_or(RodaError::MathOverflow)?;

    emit!(VaultCreated {
        owner: vault.owner,
        vault_id,
        tier: tier as u8,
    });

    Ok(())
}
