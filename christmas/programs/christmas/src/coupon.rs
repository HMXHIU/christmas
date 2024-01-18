use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::defs::*;
use crate::market::RegionMarket;
use crate::store::Store;
use crate::user::User;

#[derive(Accounts)]
pub struct RedeemCoupon<'info> {
    #[account(
        seeds = [b"coupon", mint.key().as_ref()],
        bump = coupon.bump,
        constraint = coupon.mint == mint.key()  // coupon belongs to mint
    )]
    pub coupon: Account<'info, Coupon>,
    #[account(mut)] // supply will change
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [b"user", signer.key().as_ref()], // signer must be the user
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
#[instruction(
    name: String,
    region: String,
    geo: String,
    uri: String,
    valid_from: u64,
    valid_to: u64,
)]
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
    #[account(
        init_if_needed,
        seeds = [b"market", region.as_bytes()],
        bump,
        payer = signer,
        space = RegionMarket::len()
    )]
    pub region_market: Account<'info, RegionMarket>,
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = region_market,
    )]
    pub region_market_token_account: Account<'info, TokenAccount>,
    #[account(
        seeds = [b"store", signer.key().as_ref(), &store.id.to_be_bytes()],
        constraint = store.owner == signer.key(),
        bump,
    )]
    pub store: Account<'info, Store>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
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
    pub uri: String, // to the json metadata
    pub region: String, // TODO: change to u16, use a hashmap to map integer to region to save space
    pub geo: String, // TODO: change to geohash for consistency with datehash, change to [u8; 6] to lower the size
    pub store: Pubkey,
    pub valid_from: u64,
    pub valid_to: u64,
    pub valid_from_hash: [u8; 32],
    pub valid_to_hash: [u8; 32],
    pub datehash_overflow: bool,
    pub has_supply: bool,
    pub supply: u32,
    pub bump: u8,
}

impl Coupon {
    fn len() -> usize {
        DISCRIMINATOR_SIZE
            + PUBKEY_SIZE
            + PUBKEY_SIZE
            + COUPON_NAME_SIZE
            + URI_SIZE
            + REGION_SIZE
            + GEO_SIZE
            + PUBKEY_SIZE
            + DATE_SIZE
            + DATE_SIZE
            + DATE_HASH_SIZE
            + DATE_HASH_SIZE
            + DATE_HASH_OVERFLOW_SIZE
            + HAS_SUPPLY_SIZE
            + SUPPLY_SIZE
            + BUMP_SIZE
    }
}
