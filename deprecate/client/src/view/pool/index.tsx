import React, { useState, useEffect, useCallback } from 'react';
import { PoolDisplayCard } from "./PoolDisplayCard";
import { Grid, LinearProgress, Typography } from "@mui/material";
import { isEmpty, map } from 'lodash';

import Main from "../main"

import { GetTokenAccounts, GetPDAInfo, GetPoolPDAInfo } from "../../api/api"
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
  const [userContribute, setUserContribute] = useState<Number>(0)
  const [totalPoolCount, setTotalPoolCount] = useState<Number>(0)

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

    await GetPDAInfo(wallet).then((result) => setUserContribute(Number(result.totalAmountContributed) / 1000000));  // 1000000 == 1 token )
    await GetPoolPDAInfo(wallet).then((result) => setTotalPoolCount(Number(result.totalAmountContributed) / 1000000));  // 1000000 == 1 token )
  }, [wallet]
  )

  useEffect(() => {
    const fetchData = async () => {
      if (wallet && (isEmpty(tokenAccounts || isEmpty(userContribute) || isEmpty(totalPoolCount)))) {
        await updateTokenAccounts()
      }
    }
    fetchData()
  }, [wallet, tokenAccounts, totalPoolCount, userContribute, updateTokenAccounts])

  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date();
      const christmas = new Date(now.getUTCFullYear(), 11, 25);
      if (now.getUTCMonth() === 11 && now.getUTCDate() > 25) {
        christmas.setUTCFullYear(christmas.getUTCFullYear() + 1);
      }
      const timeRemaining = christmas.getTime() - now.getTime();

      // Calculate remaining days, hours, minutes, and seconds
      const days = Math.floor(timeRemaining / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor(
        (timeRemaining % (1000 * 60 * 60)) / (1000 * 60)
      );
      const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

      // Format the countdown string
      const countdownString = `${days}d ${hours}h ${minutes}m ${seconds}s`;
      setCountdown(countdownString);
    };

    const interval = setInterval(calculateCountdown, 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <Typography
        gutterBottom
        fontSize="40px"
        fontStyle="bold"
        color="white"
        textAlign="center"
        style={{
          marginTop: "60px",
          marginBottom: "60px",
        }}
      >
        $ {totalPoolCount.toString()} USDC
      </Typography>
      {countdown === "" ? (
        <LinearProgress
          color="secondary"
          style={{ justifyContent: "center" }}
        />
      ) : (
        <Typography
          gutterBottom
          variant="h1"
          component="h1"
          color="white"
          textAlign="center"
          style={{
            marginBottom: "80px",
          }}
        >
          {countdown}
        </Typography>
      )}
      <Grid container rowSpacing={24} justifyContent="flex-start">
        <Grid item xs={12}>
          <PoolDisplayCard wallet={wallet} tokenAccounts={tokenAccounts} updateTokenAccounts={updateTokenAccounts} />
        </Grid>
      </Grid>
    </>
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
