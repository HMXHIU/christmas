use anchor_lang::prelude::*;
use solana_program::hash::hash;

use crate::defs::*;

pub fn create_user(
    ctx: Context<CreateUser>,
    email: String,
    region: String,
    geo: String,
) -> Result<()> {
    ctx.accounts.user.region = region;
    ctx.accounts.user.geo = geo;
    ctx.accounts.user.two_factor =
        hash(&[ctx.accounts.signer.key.as_ref(), email.as_bytes()].concat()).to_bytes();
    Ok(())
}

#[derive(Accounts)]
pub struct CreateUser<'info> {
    #[account(
        init_if_needed,
        payer = signer,
        seeds = [b"user", signer.key().as_ref()],
        bump,
        space = User::len(),
    )]
    pub user: Account<'info, User>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[account]
pub struct User {
    two_factor: [u8; 32],
    region: String,
    geo: String,
}

impl User {
    fn len() -> usize {
        DISCRIMINATOR_SIZE + TWO_FACTOR_SIZE + REGION_SIZE + GEO_SIZE
    }
}
