import React, { useState, useEffect, useCallback } from 'react';
import { DistributionTicker, PoolDisplayCard } from "./PoolDisplayCard";
import { Grid } from "@mui/material";
import { isEmpty, map } from 'lodash';

import Main from "../main"

import { GetTokenAccounts } from "../../api/api"
import { AccountInfo, ParsedAccountData, PublicKey } from '@solana/web3.js';
import { AnchorWallet } from '@solana/wallet-adapter-react';

export type TokenAccount = {
  id: string;
  mint: string;
  tokenAmount: string;
  tokenDecimal: string;
  pubKey: PublicKey;
  account: AccountInfo<ParsedAccountData>;
};

const PoolComponent = ({ wallet }: { wallet: AnchorWallet }) => {
  const [tokenAccounts, setTokenAccounts] = useState<[TokenAccount] | []>([])

  const updateTokenAccounts = useCallback(async () => {
    await GetTokenAccounts(wallet)
      .then((accounts) => {
        const token_accounts = map(accounts,
          ({ pubkey, account }: { pubkey: PublicKey, account: AccountInfo<ParsedAccountData> }): TokenAccount => ({
            id: pubkey.toString(),
            mint: account.data.parsed.info.mint,
            tokenAmount: account.data.parsed.info.tokenAmount.uiAmount,
            tokenDecimal: account.data.parsed.info.tokenAmount.decimals,
            pubKey: pubkey,
            account: account,
          })
        )
        // @ts-ignore
        setTokenAccounts(token_accounts)
      })
  }, [wallet]
  )

  useEffect(() => {
    const get_token_accounts = async () => {
      if (wallet && isEmpty(tokenAccounts)) {
        await updateTokenAccounts()
      }
    }
    get_token_accounts()
  }, [wallet, tokenAccounts, updateTokenAccounts])

  return (
    <Grid container rowSpacing={24} justifyContent="flex-start">
      <Grid item xs={12}>
        <DistributionTicker />
      </Grid>
      <Grid item xs={12}>
        <PoolDisplayCard wallet={wallet} tokenAccounts={tokenAccounts} updateTokenAccounts={updateTokenAccounts} />
      </Grid>
    </Grid>
  );
};

export const Pool = () => {
  return (
    <Main>
      {/* @ts-ignore */}
      <PoolComponent />
    </Main>
  );
};
