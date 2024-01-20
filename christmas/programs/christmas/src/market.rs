use crate::coupon::Coupon;
use crate::defs::*;
use crate::user::User;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
pub struct ClaimFromMarket<'info> {
    #[account(  // user needs to exist
        seeds = [b"user", signer.key().as_ref()],
        bump = user.bump,
        constraint = user.region == region_market.region, // user can only claim from his own region
        constraint = user.region == coupon.region, // user can only claim from his own region
    )]
    pub user: Account<'info, User>,
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = user,  // note: user not signer
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = mint,
        token::authority = region_market
    )]
    pub region_market_token_account: Account<'info, TokenAccount>,
    #[account(
        seeds = [b"market", region_market.region.as_ref()],
        bump = region_market.bump,
        constraint = region_market.region == coupon.region  // coupon is for this region
    )]
    pub region_market: Account<'info, RegionMarket>,
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    #[account(
        seeds = [b"coupon", mint.key().as_ref()],
        bump = coupon.bump,
        constraint = coupon.mint == mint.key(), // coupon is for this mint
        constraint = coupon.region == region_market.region  // coupon is for this region
    )]
    pub coupon: Account<'info, Coupon>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(region: [u8; 3])]
pub struct MintToMarket<'info> {
    #[account(
        init_if_needed,
        seeds = [b"market", region.as_ref()],
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
        mut,
        mint::authority = signer,
        mint::freeze_authority = signer,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        seeds = [b"coupon", mint.key().as_ref()],
        bump = coupon.bump,
        constraint = coupon.mint == mint.key(), // coupon is for this mint
        constraint = coupon.region == region_market.region,  // coupon is for this region
        constraint = coupon.update_authority == signer.key(),
    )]
    pub coupon: Account<'info, Coupon>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct RegionMarket {
    pub region: [u8; 3],
    pub bump: u8,
}

impl RegionMarket {
    pub fn len() -> usize {
        DISCRIMINATOR_SIZE + REGION_SIZE + BUMP_SIZE
    }
}
