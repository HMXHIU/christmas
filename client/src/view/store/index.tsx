import { Grid } from "@mui/material";
import { NFTDisplayList } from "../../components/NFTDisplayList";
import { MintNFTModal } from "./MintNFTModal";

export const Store = () => {
  return (
    <div>
      <Grid container rowSpacing={6}>
        <Grid item xs={12}>
          <NFTDisplayList type="store" />
        </Grid>
        <Grid item xs={12}>
          <MintNFTModal />
        </Grid>
      </Grid>
    </div>
  );
};
