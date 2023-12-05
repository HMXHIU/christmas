import {
  Box,
  Typography,
  Grid,
} from "@mui/material";
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
            <AddToPoolModal wallet={wallet} tokenAccount={tokenAccount} updateTokenAccounts={updateTokenAccounts} />
          ))}
        </Box>
      )}
    </>

  );
};