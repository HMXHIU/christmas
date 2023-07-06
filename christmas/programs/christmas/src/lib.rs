use anchor_lang::prelude::*;
use solana_program::hash::hash;
use solana_program::system_instruction;
mod coupon;
mod defs;
mod market;
mod state;
mod user;
mod utils;
use anchor_spl::token::{burn, mint_to, transfer, Burn, MintTo, Transfer};
use coupon::*;
use defs::REGION_CODES;
use market::*;
use solana_program::rent::Rent;
use state::*;
use user::*;

declare_id!("B2ejsK7m3eYPerru92hS73Gx7sQ7J83DKoLHGwn6pg5v");

#[program]
pub mod christmas {

    use crate::utils::geo::code_to_country;

    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        if !ctx.accounts.program_state.is_initialized {
            // initialize global/share state

            // set initialized
            ctx.accounts.program_state.is_initialized = true;
            ctx.accounts.program_state.bump = *ctx.bumps.get("program_state").unwrap();
        }
        Ok(())
    }

    pub fn create_user(
        ctx: Context<CreateUser>,
        email: String,
        region: String,
        geo: String,
    ) -> Result<()> {
        // check valid region
        code_to_country(&region).unwrap();

        ctx.accounts.user.region = region;
        ctx.accounts.user.geo = geo;
        ctx.accounts.user.two_factor =
            hash(&[ctx.accounts.signer.key.as_ref(), email.as_bytes()].concat()).to_bytes();
        ctx.accounts.user.bump = *ctx.bumps.get("user").unwrap();
        Ok(())
    }

    pub fn create_coupon(
        ctx: Context<CreateCoupon>,
        name: String,
        symbol: String,
        region: String,
        geo: String,
        uri: String,
    ) -> Result<()> {
        // check valid region
        code_to_country(&region).unwrap();

        ctx.accounts.coupon.update_authority = ctx.accounts.signer.key();
        ctx.accounts.coupon.mint = ctx.accounts.mint.key();
        ctx.accounts.coupon.name = name;
        ctx.accounts.coupon.symbol = symbol;
        ctx.accounts.coupon.uri = uri;
        ctx.accounts.coupon.region = region;
        ctx.accounts.coupon.geo = geo;
        ctx.accounts.coupon.bump = *ctx.bumps.get("coupon").unwrap();

        Ok(())
    }

    pub fn redeem_coupon(ctx: Context<RedeemCoupon>, num_tokens: u64) -> Result<()> {
        burn(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.mint.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                    from: ctx.accounts.user_token_account.to_account_info(),
                },
                &[&[
                    b"user".as_ref(),
                    ctx.accounts.wallet.key().as_ref(),
                    &[ctx.accounts.user.bump],
                ]],
            ),
            num_tokens,
        )?;

        Ok(())
    }

    pub fn mint_to_market(
        ctx: Context<MintToMarket>,
        region: String,
        num_tokens: u64,
    ) -> Result<()> {
        // check valid region
        code_to_country(&region).unwrap();

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

    pub fn claim_from_market(ctx: Context<ClaimFromMarket>, num_tokens: u64) -> Result<()> {
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx
                        .accounts
                        .region_market_token_account
                        .to_account_info()
                        .clone(),
                    to: ctx.accounts.user_token_account.to_account_info().clone(),
                    authority: ctx.accounts.region_market.to_account_info().clone(),
                },
                &[&[
                    b"market".as_ref(),
                    ctx.accounts.region_market.region.as_bytes(),
                    &[ctx.accounts.region_market.bump],
                ]],
            ),
            num_tokens,
        )?;

        Ok(())
    }
}
