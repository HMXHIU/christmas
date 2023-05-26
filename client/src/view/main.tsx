import React, { useEffect, useState, useCallback } from "react";
import { Grid } from "@mui/material";
import { Typography } from "@mui/material";

import { isEmpty, chain } from "lodash";
import { useAnchorWallet } from "@solana/wallet-adapter-react";

import { ListAccounts } from "../api/api";

const Main = ({ children, props }) => {
  const wallet = useAnchorWallet();
  const [nftList, setNftList] = useState([])

  const updateNFTList = useCallback(
    async () => {
      if (wallet) {
        const nft_lists = await ListAccounts(wallet)
        setNftList(
          chain(nft_lists)
            .sortBy('description')
            .map((nft) => ({
              name: nft.description,
              pubkey: nft.mint.toString(),
              data: nft,
            }))
            .value()
        );
      }
    },
    [wallet]
  )

  useEffect(() => {
    const fetchData = async () => {
      if (wallet && isEmpty(nftList)) {
        await updateNFTList();
      }
    }

    fetchData()
  }, [wallet, nftList, updateNFTList])

  return (
    <>
      {!wallet && (
        <Grid container rowSpacing={6} justifyContent="center">
          <Typography gutterBottom variant="h1" component="h1" color="white">
            Please connect to your wallet to continue.
          </Typography>
        </Grid>
      )}
      {wallet && (<>{React.cloneElement(children, { ...props, wallet, nftList, updateNFTList })}</>)}
    </>
  );
};


export default Main;