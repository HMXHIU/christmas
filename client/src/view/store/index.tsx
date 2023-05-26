import React from 'react';
import { Grid } from "@mui/material";
import { NFTDisplayList } from "../../components/NFTDisplayList";
import { MintNFTModal } from "./MintNFTModal";

import Main from "../main"

const StoreComponent = ({ nftList, updateNFTList }) => (
  <Grid container rowSpacing={6}>
    <Grid item xs={12}>
      <NFTDisplayList type="store" nftList={nftList} />
    </Grid>
    <Grid item xs={12}>
      <MintNFTModal refetch={updateNFTList} />
    </Grid>
  </Grid>
);

export const Store = () => {
  return (
    <Main>
      <StoreComponent />
    </Main>
  );
};
