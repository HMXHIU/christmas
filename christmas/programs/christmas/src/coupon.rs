use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::defs::*;
use crate::user::User;

#[derive(Accounts)]
pub struct RedeemCoupon<'info> {
    #[account(
        seeds = [b"coupon", mint.key().as_ref()],
        bump = coupon.bump,
        constraint = coupon.mint == mint.key()  // coupon belongs to mint
    )]
    pub coupon: Account<'info, Coupon>,
    /// CHECK
    pub wallet: AccountInfo<'info>,
    #[account(
        mut, // supply will change
        mint::decimals = 0,
        mint::authority = signer, // only the authority can redeem/burn the token
        mint::freeze_authority = signer,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [b"user", wallet.key().as_ref()],
        bump = user.bump,
    )]
    pub user: Account<'info, User>,
    #[account(
        mut, // balance will change
        associated_token::mint = mint, // user account to burn is associated with mint
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CreateCoupon<'info> {
    #[account(
        init_if_needed,
        payer = signer,
        mint::decimals = 0,
        mint::authority = signer,
        mint::freeze_authority = signer,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = signer,
        seeds = [b"coupon", mint.key().as_ref()],
        bump,
        space = Coupon::len(),
    )]
    pub coupon: Account<'info, Coupon>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Coupon {
    /*
    Follow Metaplex standards as much as possible
    https://docs.metaplex.com/programs/token-metadata/accounts
    */
    pub update_authority: Pubkey,
    pub mint: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String, // to the json metadata
    pub region: String,
    pub geo: String,
    pub bump: u8,
}

impl Coupon {
    fn len() -> usize {
        DISCRIMINATOR_SIZE
            + PUBKEY_SIZE
            + PUBKEY_SIZE
            + COUPON_NAME_SIZE
            + COUPON_SYMBOL_SIZE
            + COUPON_URI_SIZE
            + REGION_SIZE
            + GEO_SIZE
            + BUMP_SIZE
    }
}
