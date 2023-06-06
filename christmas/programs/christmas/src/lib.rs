use anchor_lang::prelude::*;

mod defs;
mod user;

use user::*;

declare_id!("CM12BMd4GNixByaF4mrGwgptJMhuRMZbZNF9gnYSsSpd");

#[program]
pub mod christmas {
    use super::*;

    pub fn create_user(
        ctx: Context<CreateUser>,
        email: String,
        region: String,
        geo: String,
    ) -> Result<()> {
        user::create_user(ctx, email, region, geo)
    }
}
