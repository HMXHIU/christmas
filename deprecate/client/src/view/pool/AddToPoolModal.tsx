import * as React from "react";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { Box, Grid, Modal, TextField } from "@mui/material";
import { toNumber, isEqual, isEmpty } from "lodash";

import { modalStyle } from "../../App";
import { TokenAccount } from "./index";
import { AddToPool } from "../../api/api"
import { AnchorWallet } from "@solana/wallet-adapter-react";

export const AddToPoolModal = ({ wallet, tokenAccount, updateTokenAccounts }: { wallet: AnchorWallet, tokenAccount: TokenAccount, updateTokenAccounts: () => Promise<void> }) => {
  const [open, setOpen] = React.useState(false);
  const [contribute, setContribute] = React.useState(0);
  const [txsig, setTxsig] = React.useState('');

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    setContribute(0);
  }

  const hendleContribute = async () => {
    if (!isEqual(contribute, 0)) {
      const transactionRecord = await AddToPool(wallet, tokenAccount, contribute)
      await updateTokenAccounts()
      setTxsig(transactionRecord)
    }
  }

  const handleViewTransaction = () => {
    window.open(`https://explorer.solana.com/tx/${txsig}?cluster=custom`, "_blank", "noreferrer");
  }

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
        style={{ justifySelf: "center", justifyItems: "center" }}
        variant="contained"
      >
        Contribute
      </Button>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={{ ...modalStyle, width: "80%" }}>
          <Typography color="white" variant="h1">Contribute to the pool</Typography>
          <Typography color="white" style={{ marginBottom: "5px", marginTop: "30px" }}>
            Balance: ${tokenAccount.tokenAmount} USDC
          </Typography>
          <Grid container rowSpacing={2} columnSpacing={2} paddingY={2}>
            <Grid item xs={12}>
              <TextField
                name="contribute"
                id="contribute"
                label="Contribute"
                variant="outlined"
                fullWidth
                type="number"
                onChange={(e) => setContribute(toNumber(e.target.value))}
                defaultValue={contribute}
              />
            </Grid>

            {isEmpty(txsig) && (
              <Grid item xs={12}>
                <Grid container justifyContent="right">
                  <Grid item>
                    <Button
                      variant="contained"
                      disabled={isEqual(contribute, 0) || contribute > Number(tokenAccount.tokenAmount)}
                      color="info"
                      onClick={hendleContribute}
                    >
                      Confirm
                    </Button>
                  </Grid>
                  {!isEqual(contribute, 0) && contribute <= Number(tokenAccount.tokenAmount) ? (
                    <Grid item style={{ marginLeft: "5px" }}>
                      <Button
                        variant="contained"
                        color="error"
                        onClick={() => setContribute(0)}
                        style={{ marginLeft: 4 }}
                      >
                        Cancel
                      </Button>
                    </Grid>
                  ) : null}
                </Grid>
              </Grid>
            )}
            {!isEmpty(txsig) && (
              <Grid item xs={12}>
                <Grid container justifyContent="right">
                  <Grid item>
                    <Button
                      variant="contained"
                      color="info"
                      onClick={handleViewTransaction}
                    >
                      View Transaction
                    </Button>
                  </Grid>
                  <Grid item style={{ marginLeft: "10px" }}>
                    <Button
                      variant="contained"
                      color="success"
                      onClick={handleClose}
                    >
                      Done
                    </Button>
                  </Grid>
                </Grid>
              </Grid>
            )}
          </Grid>
        </Box>
      </Modal>
    </div>
  );
};
