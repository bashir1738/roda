use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::constants::{NAME_COOLDOWN_SECS, NAME_SEED, PROFILE_SEED, USERNAME_MAX, USERNAME_MIN};
use crate::error::RodaError;
use crate::events::NameClaimed;
use crate::state::{NameProfile, RegisteredName};

/// Drain a program-owned account to zero lamports, resetting it for purge.
pub(crate) fn drain_account(info: &AccountInfo, dest: &AccountInfo) -> Result<()> {
    let lamports = info.lamports();
    **dest.try_borrow_mut_lamports()? += lamports;
    **info.try_borrow_mut_lamports()? = 0;
    info.resize(0)
        .map_err(|_| error!(RodaError::TransferFailed))?;
    info.assign(&system_program::ID);
    Ok(())
}

fn validate_name(name: &str) -> Result<()> {
    require!(name.len() >= USERNAME_MIN, RodaError::NameTooShort);
    require!(name.len() <= USERNAME_MAX, RodaError::NameTooLong);
    require!(
        name.chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_'),
        RodaError::InvalidNameChars
    );
    Ok(())
}

#[derive(Accounts)]
#[instruction(name: String)]
pub struct ClaimName<'info> {
    #[account(
        init_if_needed,
        payer = owner,
        space = NameProfile::SPACE,
        seeds = [PROFILE_SEED, owner.key().as_ref()],
        bump,
    )]
    pub profile: Account<'info, NameProfile>,

    #[account(
        init_if_needed,
        payer = owner,
        space = RegisteredName::SPACE,
        seeds = [NAME_SEED, name.as_bytes()],
        bump,
    )]
    pub name_record: Account<'info, RegisteredName>,

    /// Previous name account — only supplied when renaming (profile.name non-empty).
    /// CHECK: address is verified against the profile's current name, then drained.
    #[account(mut)]
    pub old_name_record: Option<UncheckedAccount<'info>>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimName>, name: String) -> Result<()> {
    validate_name(&name)?;

    let now = Clock::get()?.unix_timestamp;
    let owner = ctx.accounts.owner.key();

    // Already owns this exact name — no-op.
    if ctx.accounts.profile.name == name {
        return Ok(());
    }

    // Cooldown between changes (fresh profiles have last_change_ts == 0).
    if ctx.accounts.profile.last_change_ts != 0 {
        require!(
            now - ctx.accounts.profile.last_change_ts >= NAME_COOLDOWN_SECS,
            RodaError::CooldownActive
        );
    }

    // The name must be unclaimed.
    require!(
        ctx.accounts.name_record.owner == Pubkey::default(),
        RodaError::NameTaken
    );

    // Renaming: close the previous name account, returning rent to the owner.
    if !ctx.accounts.profile.name.is_empty() {
        let old = ctx
            .accounts
            .old_name_record
            .as_ref()
            .ok_or(RodaError::OldNameRecordRequired)?;
        let old_info = old.to_account_info();
        let expected = Pubkey::find_program_address(
            &[NAME_SEED, ctx.accounts.profile.name.as_bytes()],
            ctx.program_id,
        )
        .0;
        require_keys_eq!(old_info.key(), expected, RodaError::Unauthorized);
        drain_account(&old_info, &ctx.accounts.owner.to_account_info())?;
    }

    let record = &mut ctx.accounts.name_record;
    record.owner = owner;
    record.name = name.clone();
    record.claimed_at = now;
    record.bump = ctx.bumps.name_record;

    let profile = &mut ctx.accounts.profile;
    profile.owner = owner;
    profile.name = name.clone();
    profile.last_change_ts = now;
    profile.bump = ctx.bumps.profile;

    emit!(NameClaimed { owner, name });

    Ok(())
}
