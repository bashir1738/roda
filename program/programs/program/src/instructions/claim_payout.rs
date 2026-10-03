use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::{CIRCLE_AUTHORITY_SEED, CIRCLE_SEED, CONFIG_SEED};
use crate::error::RodaError;
use crate::events::PayoutReleased;
use crate::state::{Circle, CircleStatus, RodaConfig};

fn round_end_ts(round_started_ts: i64, frequency_secs: i64) -> Result<i64> {
    round_started_ts
        .checked_add(frequency_secs)
        .ok_or(RodaError::MathOverflow.into())
}

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

    /// Protocol fee recipient, fixed to the configured deployer/admin.
    /// CHECK: constrained to config.admin and used only as ATA authority.
    #[account(address = config.admin)]
    pub fee_recipient: UncheckedAccount<'info>,

    /// Deployer/admin's USDC token account for the protocol fee.
    #[account(
        init_if_needed,
        payer = recipient,
        associated_token::mint = token_mint,
        associated_token::authority = fee_recipient,
    )]
    pub fee_token_account: Account<'info, TokenAccount>,

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
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
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
    let now = Clock::get()?.unix_timestamp;
    let round_ends_at = round_end_ts(circle.round_started_ts, circle.frequency_secs)?;
    require!(now >= round_ends_at, RodaError::RoundNotReady);

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

    // Send 0.3% to the configured deployer/admin and the remainder to the
    // round recipient. Integer division rounds down, leaving tiny pools intact.
    let fee = amount
        .checked_mul(3)
        .ok_or(RodaError::MathOverflow)?
        .checked_div(1_000)
        .ok_or(RodaError::MathOverflow)?;
    let payout = amount.checked_sub(fee).ok_or(RodaError::MathOverflow)?;

    let circle_key = circle.key();
    let seeds = &[
        CIRCLE_AUTHORITY_SEED,
        circle_key.as_ref(),
        &[ctx.bumps.circle_authority],
    ];
    let signer_seeds = &[&seeds[..]];

    if fee > 0 {
        let fee_accounts = Transfer {
            from: ctx.accounts.circle_token_account.to_account_info(),
            to: ctx.accounts.fee_token_account.to_account_info(),
            authority: ctx.accounts.circle_authority.to_account_info(),
        };
        let fee_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            fee_accounts,
            signer_seeds,
        );
        token::transfer(fee_ctx, fee)?;
    }

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
    token::transfer(cpi_ctx, payout)?;

    circle.pool_balance = 0;

    let paid_round = circle.current_round;
    let completed = paid_round + 1 >= circle.member_count as u16;
    if completed {
        circle.status = CircleStatus::Completed;
    } else {
        circle.current_round = paid_round.checked_add(1).ok_or(RodaError::MathOverflow)?;
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

#[cfg(test)]
mod tests {
    use super::round_end_ts;

    fn round_ready(round_started_ts: i64, frequency_secs: i64, now: i64) -> bool {
        now >= round_end_ts(round_started_ts, frequency_secs).unwrap()
    }

    #[test]
    fn rejects_premature_payout() {
        assert!(!round_ready(1_000, 60, 1_059));
    }

    #[test]
    fn allows_payout_at_round_boundary() {
        assert!(round_ready(1_000, 60, 1_060));
    }
}
