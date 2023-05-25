use anchor_lang::prelude::*;
use anchor_spl::associated_token;
use anchor_spl::associated_token::{get_associated_token_address, AssociatedToken};
use anchor_spl::token;
use anchor_spl::token::{Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("5ZohsZtvVnjLy7TZDuujXneojE8dq27Y4mrsq3e8eKTZ");

const DISCRIMINATOR_SIZE: usize = 8;
const PUBKEY_SIZE: usize = 32;

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

        // MX - todo
        // supposed to transfer his money out into our PDA account
        // need to create a PDA account (belongs to us)

        Ok(())
    }

    pub fn mint_token(ctx: Context<MintToken>, num_tokens: u64) -> Result<()> {
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint_account.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(), // ata
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

    pub fn mint_token_to_marketplace(
        ctx: Context<MintTokenToMarket>,
        num_tokens: u64,
    ) -> Result<()> {
        /*
           1. Create a unique mint and set signer as authority
           2. Singer pays for the mint
           3. Create an ATA (signer pays) for the new mint but set the owner to christmas program
           4. Mint `num_tokens` to the ATA belonging to the christmas program
        */

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint_account.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        mint_to(cpi_ctx, num_tokens)?;
        Ok(())
    }

    pub fn claim_token_from_market(
        ctx: Context<ClaimTokenFromMarket>,
        num_tokens: u64,
    ) -> Result<()> {
        let ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.from_token_account.to_account_info(),
                to: ctx.accounts.to_token_account.to_account_info(),
                authority: ctx.accounts.signer.to_account_info(),
            },
        );
        token::transfer(ctx, num_tokens)?;

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
pub struct MintTokenToMarket<'info> {
    #[account(
        init_if_needed,
        payer = signer,
        mint::decimals = 0,
        mint::authority = signer,
        mint::freeze_authority = signer,
    )]
    pub mint_account: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint_account,
        associated_token::authority = marketplace_token_pda,  // give pda signer rights (owned by the `marketplace_token_pda`)
    )]
    pub token_account: Account<'info, TokenAccount>,
    #[account(
        init_if_needed,
        seeds = [b"mpt_pda", signer.key().as_ref(), mint_account.key().as_ref()],
        bump,
        payer = signer,
        space = MarketPlaceTokenPDA::len()
    )]
    pub marketplace_token_pda: Account<'info, MarketPlaceTokenPDA>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[derive(Accounts)]
pub struct ClaimTokenFromMarket<'info> {
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint_account,
        associated_token::authority = signer,
    )]
    pub to_token_account: Account<'info, TokenAccount>,
    pub from_token_account: Account<'info, TokenAccount>,
    pub mint_account: Account<'info, Mint>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
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

#[account]
pub struct MarketPlaceTokenPDA {
    /*
       PDA used to sign on behalf of the program
    */
    owner: Pubkey,
    mint: Pubkey,
}

impl MarketPlaceTokenPDA {
    fn len() -> usize {
        DISCRIMINATOR_SIZE + PUBKEY_SIZE + PUBKEY_SIZE
    }
}
