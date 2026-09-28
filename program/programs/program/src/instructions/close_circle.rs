use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Token, TokenAccount};

use crate::constants::{CIRCLE_AUTHORITY_SEED, CIRCLE_SEED};
use crate::error::RodaError;
use crate::events::CircleClosed;
use crate::state::{Circle, CircleStatus};

#[derive(Accounts)]
pub struct CloseCircle<'info> {
    #[account(
        mut,
        seeds = [CIRCLE_SEED, circle.id.to_le_bytes().as_ref()],
        bump = circle.bump,
        has_one = creator @ RodaError::Unauthorized,
        close = creator,
    )]
    pub circle: Account<'info, Circle>,

    /// Circle treasury authority PDA.
    /// CHECK: PDA used as authority for the circle token account.
    #[account(
        seeds = [CIRCLE_AUTHORITY_SEED, circle.key().as_ref()],
        bump,
    )]
    pub circle_authority: UncheckedAccount<'info>,

    /// Circle treasury ATA — must be empty.
    #[account(
        mut,
        constraint = circle_token_account.owner == circle_authority.key() @ RodaError::InvalidMint,
        constraint = circle_token_account.amount == 0 @ RodaError::InsufficientBalance,
    )]
    pub circle_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CloseCircle>) -> Result<()> {
    let circle_id = ctx.accounts.circle.id;
    require!(
        ctx.accounts.circle.status == CircleStatus::Completed,
        RodaError::CircleNotCompleted
    );

    // Close the treasury ATA, returning rent to the creator
    let circle_key = ctx.accounts.circle.key();
    let signer_seeds = &[
        CIRCLE_AUTHORITY_SEED,
        circle_key.as_ref(),
        &[ctx.bumps.circle_authority],
    ];
    let signer = &[&signer_seeds[..]];

    let cpi_accounts = CloseAccount {
        account: ctx.accounts.circle_token_account.to_account_info(),
        destination: ctx.accounts.creator.to_account_info(),
        authority: ctx.accounts.circle_authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer,
    );
    token::close_account(cpi_ctx)?;

    emit!(CircleClosed {
        circle_id,
        by: ctx.accounts.creator.key(),
    });

    Ok(())
}
