use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};

use crate::defs::*;

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
