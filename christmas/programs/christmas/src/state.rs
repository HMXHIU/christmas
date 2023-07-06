use crate::defs::{BOOL_SIZE, BUMP_SIZE, DISCRIMINATOR_SIZE};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init_if_needed,
        seeds = [b"state"],
        bump,
        payer = signer,
        space = ProgramState::len()
    )]
    pub program_state: Account<'info, ProgramState>,
    #[account(mut)]
    pub signer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct ProgramState {
    // Used to store global/shared state
    pub is_initialized: bool,
    pub bump: u8,
}

impl ProgramState {
    fn len() -> usize {
        DISCRIMINATOR_SIZE + BOOL_SIZE + BUMP_SIZE
    }
}
