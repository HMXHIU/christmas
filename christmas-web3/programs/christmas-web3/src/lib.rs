use anchor_lang::prelude::*;

declare_id!("F94qr5y8iCG8NNvcQpvJQVZvjcLhcHvQqwARytBjqe9T");

#[program]
pub mod christmas_web3 {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    pub fn hello(ctx: Context<SayHello>) -> Result<()> {
        msg!("Merry Christmas!");
        Ok(())
    }

    pub fn add_to_pool(ctx: Context<AddToPool>, amount: u64) -> Result<()> {
        ctx.accounts.user_account.total_amount_contributed += amount;
        msg!(
            "Total amount contributed by {} = {}!",
            ctx.accounts.user_account.key(),
            ctx.accounts.user_account.total_amount_contributed
        );
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
pub struct SayHello {}

#[derive(Accounts)]
pub struct AddToPool<'info> {
    #[account(
        init_if_needed,  // create accounts if needed
        payer = signer,  // signer = the person calling the API
        seeds = [b"user_account", signer.key().as_ref()],
        bump,
        space = 8 + 8)] // first 8 bytes is reserved by anchor
    pub user_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct UserAccount {
    total_amount_contributed: u64,
}
