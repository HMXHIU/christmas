import { DistributionTicker, PoolDisplayCard } from "./PoolDisplayCard";
import { AddToPoolModal } from "./AddToPoolModal";
import { Grid } from "@mui/material";

import Main from "../main"


const PoolComponent = () => (      
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
);

export const Pool = () => {
  return (
    <Main>
      <PoolComponent />
    </Main>
  );
};
