use anchor_lang::prelude::*;
use solana_program::hash::hash;
mod coupon;
mod defs;
mod market;
mod user;
mod utils;
use anchor_spl::token::{mint_to, MintTo};
use coupon::*;
use market::*;
use user::*;

declare_id!("B2ejsK7m3eYPerru92hS73Gx7sQ7J83DKoLHGwn6pg5v");

#[program]
pub mod christmas {
    use super::*;

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
        ctx.accounts.user.bump = *ctx.bumps.get("user").unwrap();
        Ok(())
    }

    pub fn create_coupon_mint(
        ctx: Context<CreateCouponMint>,
        name: String,
        symbol: String,
        region: String,
        geo: String,
        uri: String,
    ) -> Result<()> {
        ctx.accounts.metadata.update_authority = ctx.accounts.signer.key();
        ctx.accounts.metadata.mint = ctx.accounts.mint.key();
        ctx.accounts.metadata.name = name;
        ctx.accounts.metadata.symbol = symbol;
        ctx.accounts.metadata.uri = uri;
        ctx.accounts.metadata.region = region;
        ctx.accounts.metadata.geo = geo;
        ctx.accounts.metadata.bump = *ctx.bumps.get("metadata").unwrap();

        // TODO: check region, or set default to global

        Ok(())
    }

    pub fn mint_to_market(
        ctx: Context<MintToMarket>,
        region: String,
        num_tokens: u64,
    ) -> Result<()> {
        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.region_market_token_account.to_account_info(),
            authority: ctx.accounts.signer.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        ctx.accounts.region_market.bump = *ctx.bumps.get("region_market").unwrap();
        ctx.accounts.region_market.region = region;

        mint_to(cpi_ctx, num_tokens)?;

        Ok(())
    }
}
