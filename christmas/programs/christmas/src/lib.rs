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
use utils::utils::*;

declare_id!("B2ejsK7m3eYPerru92hS73Gx7sQ7J83DKoLHGwn6pg5v");

#[program]
pub mod christmas {

    use crate::{
        defs::{COUPON_NAME_SIZE, STORE_NAME_SIZE, STRING_PREFIX_SIZE, URI_SIZE},
        utils::geo::code_bytes_to_country,
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

    pub fn create_user(ctx: Context<CreateUser>, region: [u8; 3], uri: String) -> Result<()> {
        // check valid region
        code_bytes_to_country(&region).unwrap();

        ctx.accounts.user.region = region;
        ctx.accounts.user.bump = *ctx.bumps.get("user").unwrap();
        ctx.accounts.user.uri = pad_string(&uri, URI_SIZE - STRING_PREFIX_SIZE);
        Ok(())
    }

    pub fn update_user(ctx: Context<UpdateUser>, region: [u8; 3], uri: String) -> Result<()> {
        ctx.accounts.user.region = region;
        ctx.accounts.user.uri = pad_string(&uri, URI_SIZE - STRING_PREFIX_SIZE);
        Ok(())
    }

    pub fn create_store(
        ctx: Context<CreateStore>,
        name: String,
        id: u64,
        region: [u8; 3],
        geohash: [u8; 6],
        uri: String,
    ) -> Result<()> {
        // check valid region
        code_bytes_to_country(&region).unwrap();

        ctx.accounts.store.id = id; // unique (can have same name but different id)
        ctx.accounts.store.name = pad_string(&name, STORE_NAME_SIZE - STRING_PREFIX_SIZE);
        ctx.accounts.store.region = region;
        ctx.accounts.store.geohash = geohash;
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
        region: [u8; 3],
        geohash: [u8; 6],
        uri: String,
        valid_from: u64,
        valid_to: u64,
    ) -> Result<()> {
        // check valid region
        code_bytes_to_country(&region).unwrap();

        ctx.accounts.coupon.bump = *ctx.bumps.get("coupon").unwrap();
        ctx.accounts.coupon.update_authority = ctx.accounts.signer.key();
        ctx.accounts.coupon.mint = ctx.accounts.mint.key();
        ctx.accounts.coupon.store = ctx.accounts.store.key();
        ctx.accounts.coupon.name = pad_string(&name, COUPON_NAME_SIZE - STRING_PREFIX_SIZE);
        ctx.accounts.coupon.uri = pad_string(&uri, URI_SIZE - STRING_PREFIX_SIZE);
        ctx.accounts.coupon.region = region;
        ctx.accounts.coupon.geohash = geohash;
        ctx.accounts.coupon.valid_from = valid_from;
        ctx.accounts.coupon.valid_to = valid_to;

        // init supply
        ctx.accounts.coupon.has_supply = false;
        ctx.accounts.coupon.supply = 0;

        // calculate date hashes
        let valid_from_days: u64 = epoch_days_from_date(valid_from);
        let valid_to_days: u64 = epoch_days_from_date(valid_to);
        ctx.accounts.coupon.datehash_overflow = valid_from_days > valid_to_days;
        ctx.accounts.coupon.valid_from_hash = days_to_byte_mask(valid_from_days);
        ctx.accounts.coupon.valid_to_hash = days_to_byte_mask(valid_to_days);

        // check existing region market region else create ([0, 0, 0] is uninitialized)
        if ctx.accounts.region_market.region == [0, 0, 0] {
            ctx.accounts.region_market.region = region;
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
        region: [u8; 3],
        num_tokens: u64,
    ) -> Result<()> {
        // check valid region
        code_bytes_to_country(&region).unwrap();

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

        // update supply (NOTE: will panic when overflow but its ok - dont allow more than u32 tokens (throw a better error))
        ctx.accounts.coupon.supply += num_tokens as u32;
        if ctx.accounts.coupon.supply > 0 {
            ctx.accounts.coupon.has_supply = true;
        } else {
            ctx.accounts.coupon.has_supply = false;
        }

        Ok(())
    }

    pub fn claim_from_market(ctx: Context<ClaimFromMarket>, num_tokens: u64) -> Result<()> {
        // set user fields (from region_market) if it is being created
        if ctx.accounts.user.bump == 0 {
            ctx.accounts.user.region = ctx.accounts.region_market.region;
            ctx.accounts.user.bump = *ctx.bumps.get("user").unwrap();
        }

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
                    &ctx.accounts.region_market.region,
                    &[ctx.accounts.region_market.bump],
                ]],
            ),
            num_tokens,
        )?;

        Ok(())
    }
}
