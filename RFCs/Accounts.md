# Solana/Anchor Accounts

## UserWallet

This is the user's keypair

1. User is required to download a digital wallet
2. Small amount of solana is transfered into user's wallet on solving a captcha + 2FA
3. Used to sign user initiated transactions

## UserAccount

```
Address = PDA(CP, user_pubkey)
Owner = CP
```

This is the user's PDA with CP.

- Created when user has solved captcha
- Created when user has logged in with 2FA (web3auth/google/microsoft)
- This is the account used to own CP assets on behalf of the user (instead of his wallet)

## CPAccount

```
Address = PDA(CP, 'account', 'SG')
Owner = CP
```

This is the PDA of CP.

- This account is used to own/sign assets on behalf of CP
- Store by region for filtering

## CouponMint

```
Address = mint_pubkey
Authority = user
Signer = user
Payer = user
Owner = CPAccount
```

This is the mint created when a new coupon is created by the user.

- User minting the new coupons is the signer & payer

## CouponMintATA

## CouponATA

```
Address = PDA(CP, mint_pubkey)
Signer = user
Payer = user
Owner = CP
```

This is the associated token account for the mint tokens belonging to CP.

1. Initially created coupons by the user is minted to CP's ATA
