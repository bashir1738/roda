use anchor_lang::prelude::*;

#[event]
pub struct VaultCreated {
    pub owner: Pubkey,
    pub vault_id: u64,
    pub tier: u8,
}

#[event]
pub struct VaultDeposit {
    pub owner: Pubkey,
    pub vault_id: u64,
    pub amount: u64,
    pub balance: u64,
    pub maturity_ts: i64,
}

#[event]
pub struct VaultWithdraw {
    pub owner: Pubkey,
    pub vault_id: u64,
    pub amount: u64,
    pub balance: u64,
}

#[event]
pub struct VaultClosed {
    pub owner: Pubkey,
    pub vault_id: u64,
}

#[event]
pub struct CircleCreated {
    pub circle_id: u64,
    pub creator: Pubkey,
    pub name: String,
    pub max_members: u8,
    pub contribution_amount: u64,
    pub frequency_secs: i64,
}

#[event]
pub struct MemberJoined {
    pub circle_id: u64,
    pub member: Pubkey,
    pub member_count: u8,
}

#[event]
pub struct ContributionMade {
    pub circle_id: u64,
    pub member: Pubkey,
    pub round: u16,
    pub amount: u64,
    pub paid_count: u8,
}

#[event]
pub struct PayoutReleased {
    pub circle_id: u64,
    pub recipient: Pubkey,
    pub round: u16,
    pub amount: u64,
    pub next_round: u16,
    pub completed: bool,
}

#[event]
pub struct CircleClosed {
    pub circle_id: u64,
    pub by: Pubkey,
}

#[event]
pub struct NameClaimed {
    pub owner: Pubkey,
    pub name: String,
}

#[event]
pub struct NameReleased {
    pub owner: Pubkey,
    pub name: String,
}

#[event]
pub struct FaucetClaimed {
    pub user: Pubkey,
    pub amount: u64,
}
