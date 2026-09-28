use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::{CIRCLE_AUTHORITY_SEED, CIRCLE_SEED, CONFIG_SEED};
use crate::error::RodaError;
use crate::events::PayoutReleased;
use crate::state::{Circle, CircleStatus, RodaConfig};

#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, RodaConfig>,

    #[account(
        mut,
        seeds = [CIRCLE_SEED, circle.id.to_le_bytes().as_ref()],
        bump = circle.bump,
    )]
    pub circle: Account<'info, Circle>,

    /// Circle treasury authority PDA.
    /// CHECK: PDA used as authority for the circle token account.
    #[account(
        seeds = [CIRCLE_AUTHORITY_SEED, circle.key().as_ref()],
        bump,
    )]
    pub circle_authority: UncheckedAccount<'info>,

    /// The USDC token mint.
    #[account(constraint = token_mint.key() == config.usdc_mint @ RodaError::InvalidMint)]
    pub token_mint: Account<'info, Mint>,

    /// The current round's recipient (signer).
    #[account(
        mut,
        constraint = recipient_token_account.owner == recipient.key() @ RodaError::Unauthorized,
        constraint = recipient_token_account.mint == config.usdc_mint @ RodaError::InvalidMint,
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    /// Circle treasury ATA (source).
    #[account(
        mut,
        constraint = circle_token_account.mint == config.usdc_mint @ RodaError::InvalidMint,
        constraint = circle_token_account.owner == circle_authority.key() @ RodaError::InvalidMint,
    )]
    pub circle_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub recipient: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ClaimPayout>) -> Result<()> {
    let circle = &mut ctx.accounts.circle;

    require!(
        circle.status == CircleStatus::Active,
        RodaError::CircleNotCompleted
    );
    require!(
        circle.paid_count == circle.member_count && circle.member_count > 0,
        RodaError::NotAllPaid
    );

    let member_count = circle.member_count as usize;
    let recipient_index = (circle.current_round as usize) % member_count;
    let expected_recipient = circle.members[recipient_index];
    require_keys_eq!(
        ctx.accounts.recipient.key(),
        expected_recipient,
        RodaError::NotYourPayout
    );

    let amount = circle.pool_balance;
    require!(amount > 0, RodaError::InvalidAmount);

    // Pay out the full pot to this round's recipient
    let circle_key = circle.key();
    let seeds = &[
        CIRCLE_AUTHORITY_SEED,
        circle_key.as_ref(),
        &[ctx.bumps.circle_authority],
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_accounts = Transfer {
        from: ctx.accounts.circle_token_account.to_account_info(),
        to: ctx.accounts.recipient_token_account.to_account_info(),
        authority: ctx.accounts.circle_authority.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    token::transfer(cpi_ctx, amount)?;

    circle.pool_balance = 0;

    let paid_round = circle.current_round;
    let completed = paid_round + 1 >= circle.member_count as u16;
    if completed {
        circle.status = CircleStatus::Completed;
    } else {
        circle.current_round = paid_round
            .checked_add(1)
            .ok_or(RodaError::MathOverflow)?;
        circle.paid_count = 0;
        circle.round_started_ts = Clock::get()?.unix_timestamp;
    }

    emit!(PayoutReleased {
        circle_id: circle.id,
        recipient: expected_recipient,
        round: paid_round,
        amount,
        next_round: circle.current_round,
        completed,
    });

    Ok(())
}
