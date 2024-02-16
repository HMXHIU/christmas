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
    pub signer: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(
    name: String,
    region: [u8; 3],
    geohash: [u8; 6],
    uri: String,
    valid_from: u64,
    valid_to: u64,
)]
pub struct CreateCoupon<'info> {
    #[account(
        init_if_needed,
        payer = payer,
        mint::decimals = 0,
        mint::authority = signer,
        mint::freeze_authority = signer,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = payer,
        seeds = [b"coupon", mint.key().as_ref()],
        bump,
        space = Coupon::len(),
    )]
    pub coupon: Account<'info, Coupon>,
    #[account(
        init_if_needed,
        seeds = [b"market", region.as_ref()],
        bump,
        payer = payer,
        space = RegionMarket::len()
    )]
    pub region_market: Account<'info, RegionMarket>,
    #[account(
        init_if_needed,
        payer = payer,
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
    pub signer: Signer<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

#[account]
pub struct Coupon {
    /*
    Follow Metaplex standards as much as possible
    https://docs.metaplex.com/programs/token-metadata/accounts

    TODO: Move to Token 22 and store it in the Mint Account
    https://github.com/solana-labs/solana-program-library/tree/master/token-metadata/interface
    */
    pub update_authority: Pubkey,
    pub mint: Pubkey,
    pub name: String,
    pub uri: String, // to metadata

    // convenience fields (instead of fetching from uri)
    pub store: Pubkey,
    pub valid_from: u64,
    pub valid_to: u64,
    pub supply: u32,

    // memcmp block (must be in 1 continuous block < 128 bytes for 1 single memcmp filter, as there is a limit of 4 filters)
    pub region: [u8; 3],
    pub geohash: [u8; 6],
    pub has_supply: bool,
    pub valid_from_hash: [u8; 32],
    pub valid_to_hash: [u8; 32],
    pub datehash_overflow: bool,

    // bump
    pub bump: u8, // TODO: might not need once move to Mint Account
}

impl Coupon {
    fn len() -> usize {
        DISCRIMINATOR_SIZE
            + PUBKEY_SIZE // update_authority
            + PUBKEY_SIZE // mint
            + COUPON_NAME_SIZE
            + URI_SIZE
            // convenience fields
            + PUBKEY_SIZE // store
            + DATE_SIZE // valid_from
            + DATE_SIZE // valid_to
            + SUPPLY_SIZE
            // memcmp block
            + REGION_SIZE
            + GEOHASH_SIZE
            + HAS_SUPPLY_SIZE
            + DATE_HASH_SIZE // valid_from_hash
            + DATE_HASH_SIZE // valid_to_hash
            + DATE_HASH_OVERFLOW_SIZE
            // bump
            + BUMP_SIZE
    }
}
