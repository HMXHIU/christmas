import { DistributionTicker, PoolDisplayCard } from "./PoolDisplayCard";
import { AddToPoolModal } from "./AddToPoolModal";
import { Grid } from "@mui/material";

export const Pool = () => {
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
