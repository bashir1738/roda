use anchor_lang::prelude::*;

#[error_code]
pub enum RodaError {
    #[msg("Deposit amount is below the tier minimum.")]
    BelowMinimum,

    #[msg("Vault has not matured yet.")]
    VaultNotMatured,

    #[msg("Vault is not active.")]
    VaultNotActive,

    #[msg("Vault is already closed.")]
    VaultAlreadyClosed,

    #[msg("Insufficient vault balance.")]
    InsufficientBalance,

    #[msg("Unauthorized — only vault owner can perform this action.")]
    Unauthorized,

    #[msg("Cannot withdraw in the same block as deposit.")]
    SameBlockWithdraw,

    #[msg("Token transfer failed.")]
    TransferFailed,

    #[msg("Math overflow.")]
    MathOverflow,

    #[msg("Wrong token mint — expected the Roda USDC mint.")]
    InvalidMint,

    #[msg("Amount must be greater than zero.")]
    InvalidAmount,

    #[msg("Circle name must be 3-32 characters.")]
    InvalidCircleName,

    #[msg("max_members must be between 2 and 12.")]
    InvalidMemberCount,

    #[msg("Contribution amount must be greater than zero.")]
    InvalidContribution,

    #[msg("Round frequency must be at least 60 seconds.")]
    InvalidFrequency,

    #[msg("Circle is full.")]
    CircleFull,

    #[msg("Circle is not open for new members right now.")]
    CircleNotJoinable,

    #[msg("You already paid for the current round.")]
    AlreadyPaid,

    #[msg("Not all members have paid for the current round yet.")]
    NotAllPaid,

    #[msg("It is not your turn to receive the payout.")]
    NotYourPayout,

    #[msg("Circle has not completed all rounds yet.")]
    CircleNotCompleted,

    #[msg("Username is already taken.")]
    NameTaken,

    #[msg("This wallet has no username set.")]
    NameNotSet,

    #[msg("Username must be at least 3 characters.")]
    NameTooShort,

    #[msg("Username must be at most 20 characters.")]
    NameTooLong,

    #[msg("Username may only contain lowercase letters, numbers and underscores.")]
    InvalidNameChars,

    #[msg("24-hour cooldown active — try again later.")]
    CooldownActive,

    #[msg("Previous name account must be provided to change usernames.")]
    OldNameRecordRequired,

    #[msg("Faucet cooldown active — claim again tomorrow.")]
    FaucetCooldown,

    #[msg("Faucet unavailable — it can only mint the Roda test USDC, not the configured mint.")]
    FaucetUnavailable,
}
