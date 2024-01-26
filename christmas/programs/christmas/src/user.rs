use anchor_lang::prelude::*;

use crate::defs::*;

#[derive(Accounts)]
pub struct CreateUser<'info> {
    #[account(
        init_if_needed,
        payer = payer, // the payer might not be the signer (pay on behalf of the signer)
        seeds = [b"user", signer.key().as_ref()],
        bump,
        space = User::len(),
    )]
    pub user: Account<'info, User>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct User {
    pub region: [u8; 3],
    pub bump: u8,
}

impl User {
    pub fn len() -> usize {
        DISCRIMINATOR_SIZE + REGION_SIZE + BUMP_SIZE
    }
}
