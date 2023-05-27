import {
  Box,
  Card,
  CardActions,
  CardContent,
  LinearProgress,
  Typography,
  Grid,
} from "@mui/material";
import { useEffect, useState } from "react";
import { map, isEmpty } from 'lodash';

import { TokenAccount } from "./index";
import { AddToPoolModal } from "./AddToPoolModal";
import { AnchorWallet } from "@solana/wallet-adapter-react";

export const PoolDisplayCard = ({ wallet, tokenAccounts, updateTokenAccounts }: { wallet: AnchorWallet, tokenAccounts: [TokenAccount] | [], updateTokenAccounts: () => Promise<void> }) => {
  return (
    <>
      {isEmpty(tokenAccounts) && (
        <Grid container justifyContent="center">
          <Typography gutterBottom variant="h1" component="h1" color="white">
            No token found for contribution. Please top-up your account with supported token.
          </Typography>
        </Grid>
      )}
      {!isEmpty(tokenAccounts) && (
        <Box sx={{ minWidth: 275 }}>
          {map(tokenAccounts, (tokenAccount, index) => (
            <Card title="Pool" variant="outlined" key={index}>
              <CardContent>
                <Typography
                  sx={{ fontSize: 16 }}
                  color="text.secondary"
                  gutterBottom
                >
                  Token: {tokenAccount.mint}
                </Typography>
                <Typography variant="h5" component="div">
                  {tokenAccount.tokenAmount}
                </Typography>
              </CardContent>
              <CardActions>
                <AddToPoolModal wallet={wallet} tokenAccount={tokenAccount} updateTokenAccounts={updateTokenAccounts} />
              </CardActions>
            </Card>
          ))}
        </Box>
      )}
    </>

  );
};

// Component that renders a timer to Christmas day UTC.
export const DistributionTicker = ({ wallet, userContribute, totalPoolCount }: { wallet: AnchorWallet, userContribute: Number, totalPoolCount: Number }) => {
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
    <Box sx={{ minWidth: 275 }}>
      <Card title="Pool" variant="outlined">
        <CardContent>
          <Typography
            sx={{ fontSize: 14 }}
            color="text.secondary"
            gutterBottom
          >
            Total Contribution in Pool: {totalPoolCount.toString()}
          </Typography>
          <Typography
            sx={{ fontSize: 14 }}
            color="text.secondary"
            gutterBottom
          >
            User Contribution: {userContribute.toString()}
          </Typography>
          <Typography
            sx={{ fontSize: 14 }}
            color="text.secondary"
            gutterBottom
          >
            Time till distribution
          </Typography>
          {countdown === "" ? (
            <LinearProgress
              color="secondary"
              style={{ justifyContent: "center" }}
            />
          ) : (
            <Typography variant="h5" component="div">
              {countdown}
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};
