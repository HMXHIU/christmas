use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_lang::solana_program;
use anchor_spl::associated_token;
use anchor_spl::associated_token::{get_associated_token_address, AssociatedToken};
use anchor_spl::token;
use anchor_spl::token::{Mint, MintTo, Token, TokenAccount, Transfer};

declare_id!("5ZohsZtvVnjLy7TZDuujXneojE8dq27Y4mrsq3e8eKTZ");

const DISCRIMINATOR_SIZE: usize = 8;
const PUBKEY_SIZE: usize = 32;
const U8_SIZE: usize = 1;
const TOKEN_DESCRIPTION_SIZE: usize = 4 + 50;

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
        // Check if user account has been initialized
        if !ctx.accounts.user_account.is_initialized {
            ctx.accounts.user_account.is_initialized = true;
            ctx.accounts.user_account.total_amount_contributed = 0;
        }

        // Check if christmas account has been initialized
        if !ctx.accounts.christmas_account.is_initialized {
            ctx.accounts.christmas_account.is_initialized = true;
            ctx.accounts.christmas_account.total_amount_contributed = 0;
        }

        // Proceed to transfer
        let cpi_program: AccountInfo = ctx.accounts.token_program.to_account_info(); // The program that we are calling
        let cpi_accounts: Transfer = Transfer {
            from: ctx.accounts.user_usdc_account.to_account_info(),
            to: ctx.accounts.christmas_usdc_account.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        };

        // ::new since the signer has already sign the transaction
        let token_transfer_context: CpiContext<Transfer> = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(token_transfer_context, amount)?;

        // record his contribution
        ctx.accounts.user_account.total_amount_contributed = amount;
        ctx.accounts.christmas_account.total_amount_contributed += amount;
        ctx.accounts.christmas_account.mint = ctx.accounts.mint.key();

        msg!(
            "Total amount contributed by {} = {}!",
            ctx.accounts.user_account.key(),
            ctx.accounts.user_account.total_amount_contributed
        );

        Ok(())
    }

    pub fn mint_token_to_marketplace(
        ctx: Context<MintTokenToMarket>,
        description: String,
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
        ctx.accounts.marketplace_token_pda.description = description; // TODO: check length of string < TOKEN_DESCRIPTION_SIZE

        mint_to(cpi_ctx, num_tokens)?;
        Ok(())
    }

    // pub fn claim_token_from_market(
    //     ctx: Context<ClaimTokenFromMarket>,
    //     num_tokens: u64,
    // ) -> Result<()> {
    //     token::transfer(
    //         // `new_with_signer` lets pda sign on behalf of program
    //         CpiContext::new_with_signer(
    //             ctx.accounts.token_program.to_account_info(),
    //             Transfer {
    //                 from: ctx.accounts.marketplace_token_pda_ata.to_account_info(),
    //                 to: ctx.accounts.to_token_account.to_account_info(),
    //                 authority: ctx.accounts.marketplace_token_pda.to_account_info(),
    //             },
    //             &[&[
    //                 b"mpt_pda".as_ref(),
    //                 &ctx.accounts.marketplace_token_pda.owner.to_bytes(),
    //                 &ctx.accounts.marketplace_token_pda.mint.to_bytes(),
    //                 &[ctx.accounts.marketplace_token_pda.bump],
    //             ]],
    //         ),
    //         num_tokens,
    //     )?;

    //     Ok(())
    // }
}

#[derive(Accounts)]
pub struct SayHello {}

#[derive(Accounts)]
pub struct AddToPool<'info> {
    // create user's account with us if not already
    #[account(
        init_if_needed,
        payer = signer,
        seeds = [b"user_account", signer.key().as_ref()],
        bump,
        space = UserAccount::len())]
    pub user_account: Account<'info, UserAccount>,

    #[account(
        init_if_needed,
        payer = signer, // If init required, payer will be initializer
        seeds = [b"christmas_account"],
        bump, 
        space = ChristmasAccount::len()
    )]
    pub christmas_account: Account<'info, ChristmasAccount>,

    #[account(
        mut,
        constraint = user_usdc_account.owner.key() == signer.key(),
        constraint = user_usdc_account.mint == mint.key(),
        constraint = user_usdc_account.amount > 0, // User must have some USDC
    )]
    pub user_usdc_account: Account<'info, TokenAccount>,

    // Check if accounts has correct owner, mint and has amount of 1
    #[account(
        mut,
        constraint = christmas_usdc_account.owner == christmas_account.key(),
        constraint = christmas_usdc_account.mint == mint.key(),
        constraint = christmas_usdc_account.amount > 0, // check for USDC amount
    )]
    pub christmas_usdc_account: Account<'info, TokenAccount>,

    #[account(constraint = christmas_account.mint == mint.key())]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub signer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
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
        space = MarketPlaceTokenPDA::len(),
    )]
    pub marketplace_token_pda: Account<'info, MarketPlaceTokenPDA>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

// #[derive(Accounts)]
// pub struct ClaimTokenFromMarket<'info> {
//     #[account(
//         init_if_needed,
//         payer = signer,
//         associated_token::mint = mint_account,
//         associated_token::authority = to_token_account,
//     )]
//     pub to_token_account: Account<'info, TokenAccount>,
//     #[account(mut)]
//     pub marketplace_token_pda_ata: Account<'info, TokenAccount>,

//     #[account(mut)]
//     pub signer: Signer<'info>,

//     #[account(
//         mut,
//         seeds = [b"mpt_pda", marketplace_token_pda.owner.as_ref(), mint_account.key().as_ref()],
//         bump
//     )]
//     pub marketplace_token_pda: Account<'info, MarketPlaceTokenPDA>,
//     pub mint_account: Account<'info, Mint>,
//     pub token_program: Program<'info, Token>,
//     pub system_program: Program<'info, System>,
//     pub associated_token_program: Program<'info, AssociatedToken>,
//     pub rent: Sysvar<'info, Rent>,
// }

#[account]
pub struct UserAccount {
    is_initialized: bool,
    total_amount_contributed: u64,
}

#[account]
pub struct ChristmasAccount {
    is_initialized: bool,
    mint: Pubkey,
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
    description: String
}

impl MarketPlaceTokenPDA {
    fn len() -> usize {
        DISCRIMINATOR_SIZE + PUBKEY_SIZE + PUBKEY_SIZE + U8_SIZE + TOKEN_DESCRIPTION_SIZE
    }
}

const DISCRIMINATOR: usize = 8;
const PUBKEY: usize = 32;
const BOOL: usize = 1;
const U64: usize = 8;

impl UserAccount {
    fn len() -> usize {
        DISCRIMINATOR + BOOL + U64
    }
}

impl ChristmasAccount {
    fn len() -> usize {
        DISCRIMINATOR + BOOL + PUBKEY + U64
    }
}
