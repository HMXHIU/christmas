use anchor_lang::prelude::*;

use crate::{defs::*, state::ProgramState};

#[derive(Accounts)]
#[instruction(name: String, id: u64)]
pub struct CreateStore<'info> {
    #[account(
        init_if_needed,
        payer = signer,
        seeds = [b"store", signer.key().as_ref(), &id.to_be_bytes()],
        bump,
        constraint = id == state.store_counter,
        space = Store::len(),
    )]
    pub store: Account<'info, Store>,
    #[account(mut)]
    pub signer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"state"],
        bump = state.bump
    )]
    pub state: Account<'info, ProgramState>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Store {
    pub id: u64, // unique to each store, check `store_counter` in `state`
    pub name: String,
    pub region: [u8; 3],
    pub geohash: [u8; 6],
    pub uri: String,   // to the json metadata
    pub owner: Pubkey, // set to signer
    pub bump: u8,
}

impl Store {
    pub fn len() -> usize {
        DISCRIMINATOR_SIZE
            + U64_SIZE
            + STORE_NAME_SIZE
            + REGION_SIZE
            + GEOHASH_SIZE
            + URI_SIZE
            + PUBKEY_SIZE
            + BUMP_SIZE
    }
}
