use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::constants::{
    CIRCLE_AUTHORITY_SEED, CIRCLE_CODE_MAX, CIRCLE_CODE_MIN, CIRCLE_NAME_MAX, CIRCLE_NAME_MIN,
    CIRCLE_SEED, CONFIG_SEED, MAX_CIRCLE_MEMBERS, MEMBER_SEED, MIN_CIRCLE_MEMBERS,
    MIN_FREQUENCY_SECS, PAID_ROUND_NONE,
};
use crate::error::RodaError;
use crate::events::CircleCreated;
use crate::state::{Circle, CircleMember, CircleStatus, RodaConfig};

#[derive(Accounts)]
#[instruction(circle_code: u64, name: String, max_members: u8)]
pub struct CreateCircle<'info> {
    #[account(
        mut,
        seeds = [CONFIG_SEED],
        bump = config.bump,
    )]
    pub config: Account<'info, RodaConfig>,

    #[account(
        init,
        payer = creator,
        space = Circle::space(max_members),
        seeds = [CIRCLE_SEED, circle_code.to_le_bytes().as_ref()],
        bump,
    )]
    pub circle: Account<'info, Circle>,

    /// Creator's membership record (creator is always member #1).
    #[account(
        init,
        payer = creator,
        space = CircleMember::SPACE,
        seeds = [MEMBER_SEED, circle.key().as_ref(), creator.key().as_ref()],
        bump,
    )]
    pub creator_member: Account<'info, CircleMember>,

    /// Circle treasury authority PDA — signs circle token transfers.
    /// CHECK: PDA used as authority for the circle token account.
    #[account(
        seeds = [CIRCLE_AUTHORITY_SEED, circle.key().as_ref()],
        bump,
    )]
    pub circle_authority: UncheckedAccount<'info>,

    /// The USDC token mint.
    #[account(constraint = token_mint.key() == config.usdc_mint @ RodaError::InvalidMint)]
    pub token_mint: Account<'info, Mint>,

    /// Circle treasury ATA. Created if needed.
    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = token_mint,
        associated_token::authority = circle_authority,
    )]
    pub circle_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateCircle>,
    circle_code: u64,
    name: String,
    max_members: u8,
    contribution_amount: u64,
    frequency_secs: i64,
) -> Result<()> {
    require!(
        circle_code >= CIRCLE_CODE_MIN && circle_code <= CIRCLE_CODE_MAX,
        RodaError::InvalidCircleCode
    );
    let name_len = name.chars().count();
    require!(
        name_len >= CIRCLE_NAME_MIN && name_len <= CIRCLE_NAME_MAX,
        RodaError::InvalidCircleName
    );
    require!(
        max_members >= MIN_CIRCLE_MEMBERS && max_members <= MAX_CIRCLE_MEMBERS,
        RodaError::InvalidMemberCount
    );
    require!(contribution_amount > 0, RodaError::InvalidContribution);
    require!(
        frequency_secs >= MIN_FREQUENCY_SECS,
        RodaError::InvalidFrequency
    );

    let config = &mut ctx.accounts.config;
    let circle = &mut ctx.accounts.circle;
    let now = Clock::get()?.unix_timestamp;
    let creator = ctx.accounts.creator.key();

    circle.id = circle_code;
    circle.creator = creator;
    circle.name = name.clone();
    circle.max_members = max_members;
    circle.member_count = 1;
    circle.paid_count = 0;
    circle.contribution_amount = contribution_amount;
    circle.frequency_secs = frequency_secs;
    circle.current_round = 0;
    circle.pool_balance = 0;
    circle.round_started_ts = now;
    circle.status = CircleStatus::Active;
    circle.members = vec![creator];
    circle.bump = ctx.bumps.circle;

    let member = &mut ctx.accounts.creator_member;
    member.circle = circle.key();
    member.member = creator;
    member.joined_round = 0;
    member.paid_round = PAID_ROUND_NONE;
    member.bump = ctx.bumps.creator_member;

    let circle_id = circle.id;
    config.circle_count = config
        .circle_count
        .checked_add(1)
        .ok_or(RodaError::MathOverflow)?;

    emit!(CircleCreated {
        circle_id,
        creator,
        name,
        max_members,
        contribution_amount,
        frequency_secs,
    });

    Ok(())
}
