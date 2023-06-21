use crate::defs::*;
use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{Mint, Token, TokenAccount};

#[derive(Accounts)]
#[instruction(region: String)]
pub struct MintToMarket<'info> {
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
        mut,
        mint::authority = signer,
        mint::freeze_authority = signer,
    )]
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct RegionMarket {
    pub region: String,
    pub bump: u8,
}

impl RegionMarket {
    fn len() -> usize {
        DISCRIMINATOR_SIZE + REGION_SIZE + BUMP_SIZE
    }
}
