use anchor_lang::prelude::*;

use crate::defs::*;

#[derive(Accounts)]
#[instruction(name: String)]
pub struct CreateStore<'info> {
    #[account(
        init_if_needed,
        payer = signer,
        seeds = [b"store", name.as_bytes(), signer.key().as_ref()],
        bump,
        space = Store::len(),
    )]
    pub store: Account<'info, Store>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Store {
    pub name: String,
    pub region: String,
    pub geo: String,
    pub uri: String, // to the json metadata
    pub bump: u8,
}

impl Store {
    pub fn len() -> usize {
        DISCRIMINATOR_SIZE + STORE_NAME_SIZE + REGION_SIZE + GEO_SIZE + STORE_URI_SIZE + BUMP_SIZE
    }
}
