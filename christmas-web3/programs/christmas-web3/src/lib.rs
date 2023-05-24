use anchor_lang::prelude::*;
use anchor_spl::token;
use anchor_spl::token::{Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("5ZohsZtvVnjLy7TZDuujXneojE8dq27Y4mrsq3e8eKTZ");

#[program]
pub mod christmas_web3 {
    use core::num;

    use anchor_lang::system_program::transfer;
    use anchor_spl::token::mint_to;

    use super::*;

    pub fn say_hello(ctx: Context<SayHello>) -> Result<()> {
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

    pub fn mint_token(ctx: Context<MintToken>, num_tokens: u64) -> Result<()> {
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint_account.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token::mint_to(cpi_ctx, num_tokens)?;

        msg!(
            "{} minted {} tokens using mint={}!",
            ctx.accounts.signer.key(),
            num_tokens,
            ctx.accounts.mint_account.key()
        );

        Ok(())
    }

    pub fn transfer_token(ctx: Context<TransferToken>, num_tokens: u64) -> Result<()> {
        let tx = Transfer {
            from: ctx.accounts.from_account.to_account_info(),
            to: ctx.accounts.to_account.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        };

        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, tx);

        token::transfer(cpi_ctx, num_tokens)?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct SayHello {}

#[derive(Accounts)]
pub struct AddToPool<'info> {
    #[account(
        init_if_needed,
        payer = signer,
        seeds = [b"user_account", signer.key().as_ref()],
        bump,
        space = 8 + 8)]
    pub user_account: Account<'info, UserAccount>, // create user's account with us if not already
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintToken<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(mut)]
    pub mint_account: Account<'info, Mint>,
    #[account(mut)]
    pub token_account: Account<'info, TokenAccount>, // User's Associated Token Account to hold the minted nft token
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TransferToken<'info> {
    #[account(mut)]
    pub from_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub to_account: Account<'info, UserAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct UserAccount {
    total_amount_contributed: u64,
}
