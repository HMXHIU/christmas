use anchor_lang::prelude::*;
mod coupon;
mod defs;
mod market;
mod state;
mod store;
mod user;
mod utils;
use anchor_spl::token::{burn, mint_to, transfer, Burn, MintTo, Transfer};
use coupon::*;
use market::*;
use solana_program::rent::Rent;
use state::*;
use store::*;
use user::*;
use utils::utils::pad_string;

declare_id!("B2ejsK7m3eYPerru92hS73Gx7sQ7J83DKoLHGwn6pg5v");

#[program]
pub mod christmas {

    use crate::{
        defs::{
            COUPON_NAME_SIZE, COUPON_SYMBOL_SIZE, GEO_SIZE, REGION_SIZE, STORE_NAME_SIZE,
            STRING_PREFIX_SIZE, URI_SIZE,
        },
        utils::geo::code_to_country,
    };

    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        if !ctx.accounts.program_state.is_initialized {
            // initialize global/share state

            // set initialized
            ctx.accounts.program_state.is_initialized = true;
            ctx.accounts.program_state.store_counter = 0;
            ctx.accounts.program_state.bump = *ctx.bumps.get("program_state").unwrap();
        }
        Ok(())
    }

    pub fn create_user(ctx: Context<CreateUser>, region: String, geo: String) -> Result<()> {
        // check valid region
        code_to_country(&region).unwrap();

        ctx.accounts.user.region = pad_string(&region, REGION_SIZE - STRING_PREFIX_SIZE);
        ctx.accounts.user.geo = pad_string(&geo, GEO_SIZE - STRING_PREFIX_SIZE);
        ctx.accounts.user.bump = *ctx.bumps.get("user").unwrap();
        Ok(())
    }

    pub fn create_store(
        ctx: Context<CreateStore>,
        name: String,
        id: u64,
        region: String,
        geo: String,
        uri: String,
    ) -> Result<()> {
        // check valid region
        code_to_country(&region).unwrap();

        ctx.accounts.store.id = id;
        ctx.accounts.store.name = pad_string(&name, STORE_NAME_SIZE - STRING_PREFIX_SIZE);
        ctx.accounts.store.region = pad_string(&region, REGION_SIZE - STRING_PREFIX_SIZE);
        ctx.accounts.store.geo = pad_string(&geo, GEO_SIZE - STRING_PREFIX_SIZE);
        ctx.accounts.store.uri = pad_string(&uri, URI_SIZE - STRING_PREFIX_SIZE);
        ctx.accounts.store.owner = ctx.accounts.signer.key();
        ctx.accounts.store.bump = *ctx.bumps.get("store").unwrap();

        // increment `store_counter` (Note: there is a max of 2^64 store)
        ctx.accounts.state.store_counter = ctx.accounts.state.store_counter.saturating_add(1);

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
        ctx.accounts.coupon.store = ctx.accounts.store.key();
        ctx.accounts.coupon.name = pad_string(&name, COUPON_NAME_SIZE - STRING_PREFIX_SIZE);
        ctx.accounts.coupon.symbol = pad_string(&symbol, COUPON_SYMBOL_SIZE - STRING_PREFIX_SIZE);
        ctx.accounts.coupon.uri = pad_string(&uri, URI_SIZE - STRING_PREFIX_SIZE);
        ctx.accounts.coupon.region = pad_string(&region, REGION_SIZE - STRING_PREFIX_SIZE);
        ctx.accounts.coupon.geo = pad_string(&geo, GEO_SIZE - STRING_PREFIX_SIZE);
        ctx.accounts.coupon.bump = *ctx.bumps.get("coupon").unwrap();

        // check existing region market region else create
        if ctx.accounts.region_market.region.is_empty() {
            ctx.accounts.region_market.region =
                pad_string(&region, REGION_SIZE - STRING_PREFIX_SIZE);
            ctx.accounts.region_market.bump = *ctx.bumps.get("region_market").unwrap();
        } else {
            assert!(ctx.accounts.region_market.region == region);
            assert!(ctx.accounts.region_market.bump == *ctx.bumps.get("region_market").unwrap())
        }

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
                    ctx.accounts.signer.key().as_ref(),
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
        ctx.accounts.region_market.region = pad_string(&region, REGION_SIZE - STRING_PREFIX_SIZE);

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
