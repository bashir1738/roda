use anchor_lang::prelude::*;

use crate::constants::{CIRCLE_SEED, MEMBER_SEED, PAID_ROUND_NONE};
use crate::error::RodaError;
use crate::events::MemberJoined;
use crate::state::{Circle, CircleMember, CircleStatus};

#[derive(Accounts)]
#[instruction(circle_id: u64)]
pub struct JoinCircle<'info> {
    #[account(
        mut,
        seeds = [CIRCLE_SEED, circle_id.to_le_bytes().as_ref()],
        bump = circle.bump,
    )]
    pub circle: Account<'info, Circle>,

    #[account(
        init,
        payer = member,
        space = CircleMember::SPACE,
        seeds = [MEMBER_SEED, circle.key().as_ref(), member.key().as_ref()],
        bump,
    )]
    pub member_account: Account<'info, CircleMember>,

    #[account(mut)]
    pub member: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<JoinCircle>, circle_id: u64) -> Result<()> {
    let circle = &mut ctx.accounts.circle;

    require!(
        circle.status == CircleStatus::Active,
        RodaError::CircleNotJoinable
    );
    require!(
        circle.member_count < circle.max_members,
        RodaError::CircleFull
    );
    // Joins are only allowed before contributions land for the current round.
    require!(
        circle.paid_count == 0 && !circle.members.contains(&ctx.accounts.member.key()),
        RodaError::CircleNotJoinable
    );

    let member_key = ctx.accounts.member.key();
    circle.members.push(member_key);
    circle.member_count = circle
        .member_count
        .checked_add(1)
        .ok_or(RodaError::MathOverflow)?;

    let record = &mut ctx.accounts.member_account;
    record.circle = circle.key();
    record.member = member_key;
    record.joined_round = circle.current_round;
    record.paid_round = PAID_ROUND_NONE;
    record.bump = ctx.bumps.member_account;

    emit!(MemberJoined {
        circle_id,
        member: member_key,
        member_count: circle.member_count,
    });

    Ok(())
}
