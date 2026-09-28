use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::constants::{CIRCLE_AUTHORITY_SEED, CIRCLE_SEED, CONFIG_SEED, MEMBER_SEED};
use crate::error::RodaError;
use crate::events::ContributionMade;
use crate::state::{Circle, CircleMember, RodaConfig};

#[derive(Accounts)]
pub struct Contribute<'info> {
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

    /// The signer's membership record for this circle.
    #[account(
        mut,
        seeds = [MEMBER_SEED, circle.key().as_ref(), owner.key().as_ref()],
        bump = member_account.bump,
        constraint = member_account.member == owner.key() @ RodaError::Unauthorized,
        constraint = member_account.circle == circle.key() @ RodaError::Unauthorized,
    )]
    pub member_account: Account<'info, CircleMember>,

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

    /// Member's token account (source of funds).
    #[account(
        mut,
        constraint = user_token_account.owner == owner.key() @ RodaError::Unauthorized,
        constraint = user_token_account.mint == config.usdc_mint @ RodaError::InvalidMint,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    /// Circle treasury ATA (destination).
    #[account(
        mut,
        constraint = circle_token_account.mint == config.usdc_mint @ RodaError::InvalidMint,
        constraint = circle_token_account.owner == circle_authority.key() @ RodaError::InvalidMint,
    )]
    pub circle_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<Contribute>, amount: u64) -> Result<()> {
    let circle = &mut ctx.accounts.circle;

    require!(amount > 0, RodaError::InvalidAmount);
    require!(
        amount == circle.contribution_amount,
        RodaError::InvalidContribution
    );
    require!(
        circle.paid_count < circle.member_count,
        RodaError::NotAllPaid
    );

    let member = &mut ctx.accounts.member_account;
    require!(
        member.paid_round != circle.current_round,
        RodaError::AlreadyPaid
    );

    // Transfer contribution: member → circle treasury
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.circle_token_account.to_account_info(),
        authority: ctx.accounts.owner.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi_ctx, amount)?;

    member.paid_round = circle.current_round;
    circle.pool_balance = circle
        .pool_balance
        .checked_add(amount)
        .ok_or(RodaError::MathOverflow)?;
    circle.paid_count = circle
        .paid_count
        .checked_add(1)
        .ok_or(RodaError::MathOverflow)?;

    emit!(ContributionMade {
        circle_id: circle.id,
        member: member.member,
        round: circle.current_round,
        amount,
        paid_count: circle.paid_count,
    });

    Ok(())
}
