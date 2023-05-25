use anchor_lang::prelude::*;
use anchor_spl::associated_token;
use anchor_spl::associated_token::{get_associated_token_address, AssociatedToken};
use anchor_spl::token;
use anchor_spl::token::{Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("5ZohsZtvVnjLy7TZDuujXneojE8dq27Y4mrsq3e8eKTZ");

const DISCRIMINATOR_SIZE: usize = 8;
const PUBKEY_SIZE: usize = 32;
const U8_SIZE: usize = 1;

#[program]
pub mod christmas_web3 {
    use core::num;

    use anchor_lang::{solana_program::program::invoke_signed, system_program::transfer};
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
        bump: u8,
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

        // set `marketplace_token_pda` related data
        ctx.accounts.marketplace_token_pda.owner = ctx.accounts.signer.key();
        ctx.accounts.marketplace_token_pda.mint = ctx.accounts.mint_account.key();
        ctx.accounts.marketplace_token_pda.bump = bump;

        mint_to(cpi_ctx, num_tokens)?;
        Ok(())
    }

    pub fn claim_token_from_market(
        ctx: Context<ClaimTokenFromMarket>,
        num_tokens: u64,
    ) -> Result<()> {
        let bump = &[ctx.accounts.marketplace_token_pda.bump];
        let seeds = &[&[
            b"mpt_pda",
            ctx.accounts.marketplace_token_pda.owner.as_ref(),
            ctx.accounts.marketplace_token_pda.mint.as_ref(),
            bump,
        ][..]];

        // `new_with_signer` lets pda sign on behalf of program
        let ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.marketplace_token_pda_ata.to_account_info(),
                to: ctx.accounts.to_token_account.to_account_info(),
                authority: ctx.accounts.marketplace_token_pda.to_account_info(),
            },
            seeds,
        );

        token::transfer(ctx, num_tokens)?;

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
        payer = marketplace_token_pda,  // TODO: anyone can keep calling to make `marketplace_token_pda` pay?
        associated_token::mint = mint_account,
        associated_token::authority = to_token_account,
    )]
    pub to_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub marketplace_token_pda_ata: Account<'info, TokenAccount>,
    #[account(mut)]
    pub marketplace_token_pda: Account<'info, MarketPlaceTokenPDA>,
    pub mint_account: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
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
    bump: u8,
}

impl MarketPlaceTokenPDA {
    fn len() -> usize {
        DISCRIMINATOR_SIZE + PUBKEY_SIZE + PUBKEY_SIZE + U8_SIZE
    }
}
