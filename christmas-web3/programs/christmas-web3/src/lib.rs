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
}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
pub struct SayHello {}
