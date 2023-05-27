import React, { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Modal from "@mui/material/Modal";
import { Grid, TextField } from "@mui/material";

import { isEmpty, isEqual } from 'lodash';

import { modalStyle } from "../../App";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { MintTokenToMarketplace } from "../../api/api";

export const MintNFTModal = ({ refetch }) => {

  const wallet = useAnchorWallet();
  const [description, setDescription] = useState('');
  const [mintAmount, setMintAmount] = useState(1);
  const [descriptionError, setDescriptionError] = useState('');

  // none - show text box for user to enter info
  // success - successfully minted token
  // failed - failed to mint token
  const [showResult, setShowResult] = useState('none');

  const [open, setOpen] = React.useState(false);
  const handleOpen = () => {
    setOpen(true)

  };
  const handleClose = () => {
    setDescription('');
    setMintAmount(1);
    setDescriptionError('');
    setShowResult('none');
    setOpen(false);
  };

  const handleMintClick = async () => {
    if (isEmpty(description)) {
      setDescriptionError('Description cannot be empty.')
    } else if (wallet) {
      await MintTokenToMarketplace(
        wallet,
        mintAmount,
        description
      ).then(async (x) => {
        if (x) {
          await refetch();
          setShowResult('success')
        } else {
          setShowResult('failed')
        }
      })
    } else {
      setShowResult('failed')
    }
  }

  const cost = 0.03;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Button
        onClick={handleOpen}
        variant="contained"
        style={{ display: "flex" }}
      >
        Mint
      </Button>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={{ ...modalStyle, width: "40%" }}>
          {isEqual(showResult, 'success') && (
            <Grid container direction="column" justifyContent="center">
              <img
                alt="success"
                src='https://i.gifer.com/7efs.gif'
                width="100%"
              />
              <Button
                onClick={handleClose}
                variant="contained"
                style={{ display: "flex", marginTop: "20px" }}
              >
                Close
              </Button>
            </Grid>
          )}
          {isEqual(showResult, 'failed') && (
            <Grid container direction="column" justifyContent="center">
              <img
                alt="failed"
                src='https://i.gifer.com/y7.gif'
                width="100%"
              />
              <Typography
                id="modal-modal-title"
                variant="h6"
                component="h2"
                color="white"
                textAlign="center"
                style={{ marginTop: "20px" }}
              >
                Ensure your wallet is connected.
              </Typography>
              <Button
                onClick={handleClose}
                variant="contained"
                style={{ display: "flex", marginTop: "20px" }}
              >
                Close
              </Button>
            </Grid>
          )}
          {isEqual(showResult, 'none') && (
            <>
              <Typography
                id="modal-modal-title"
                variant="h6"
                component="h2"
                color="white"
              >
                Mint NFT
              </Typography>
              <Grid container rowSpacing={2} paddingY={2}>
                <Grid item xs={12}>
                  <TextField
                    name="description"
                    id="description"
                    label={isEmpty(descriptionError) ? 'description' : descriptionError}
                    variant="outlined"
                    fullWidth
                    error={!isEmpty(descriptionError)}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </Grid>
                {/*<Grid item xs={12}>
                  <TextField
                    name="store_location"
                    id="store_location"
                    label="store location"
                    variant="outlined"
                    fullWidth
                  />
                </Grid>*/}
                <Grid item xs={12}>
                  <TextField
                    name="supply"
                    id="supply"
                    label="supply"
                    variant="outlined"
                    fullWidth
                    type="number"
                    onChange={(e) => setMintAmount(e.target.value)}
                    defaultValue={mintAmount}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography color="white">Estimated costs: {cost}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Button variant="contained" type="submit" onClick={handleMintClick}>
                    Mint
                  </Button>
                </Grid>
              </Grid>
            </>
          )}
        </Box>
      </Modal>
    </div>
  );
};
