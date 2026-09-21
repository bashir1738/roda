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
}
