import { DistributionTicker, PoolDisplayCard } from "./PoolDisplayCard";
import { AddToPoolModal } from "./AddToPoolModal";
import { Grid } from "@mui/material";
import { useAnchorWallet } from "@solana/wallet-adapter-react";

import { ListAccounts } from "../../api/api";
      
  
  

export const Pool = () => {

  const wallet = useAnchorWallet();

  /*
    TEST IDL
  */



  if (wallet) {
    ListAccounts(wallet);
  }
  
  return (
    <div>
      <Grid container rowSpacing={6}>
        <Grid item xs={12}>
          <PoolDisplayCard />
        </Grid>
        <Grid item xs={12}>
          <DistributionTicker />
        </Grid>
        <Grid item xs={12} style={{ justifyContent: "center" }}>
          <AddToPoolModal />
        </Grid>
      </Grid>
    </div>
  );
};
