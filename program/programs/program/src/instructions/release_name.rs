use anchor_lang::prelude::*;

use crate::constants::{NAME_SEED, PROFILE_SEED};
use crate::error::RodaError;
use crate::events::NameReleased;
use crate::instructions::claim_name::drain_account;
use crate::state::NameProfile;

#[derive(Accounts)]
pub struct ReleaseName<'info> {
    #[account(
        mut,
        seeds = [PROFILE_SEED, owner.key().as_ref()],
        bump = profile.bump,
        constraint = profile.owner == owner.key() @ RodaError::Unauthorized,
    )]
    pub profile: Account<'info, NameProfile>,

    /// The RegisteredName PDA for the profile's current name.
    /// CHECK: address is verified against profile.name, then drained.
    #[account(mut)]
    pub name_record: UncheckedAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ReleaseName>) -> Result<()> {
    let profile = &ctx.accounts.profile;
    require!(!profile.name.is_empty(), RodaError::NameNotSet);

    // Verify the provided account is the name PDA for this profile's name.
    let expected =
        Pubkey::find_program_address(&[NAME_SEED, profile.name.as_bytes()], ctx.program_id).0;
    require_keys_eq!(
        ctx.accounts.name_record.key(),
        expected,
        RodaError::Unauthorized
    );

    let name = profile.name.clone();
    drain_account(
        &ctx.accounts.name_record.to_account_info(),
        &ctx.accounts.owner.to_account_info(),
    )?;

    let profile = &mut ctx.accounts.profile;
    profile.name = String::new();
    profile.last_change_ts = Clock::get()?.unix_timestamp;

    emit!(NameReleased {
        owner: profile.owner,
        name,
    });

    Ok(())
}
