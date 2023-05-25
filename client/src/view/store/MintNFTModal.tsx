import * as React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Modal from "@mui/material/Modal";
import { Grid, TextField } from "@mui/material";
import { modalStyle } from "../../App";

export const MintNFTModal = () => {
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
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
        <Box sx={{ ...modalStyle, width: "80%" }}>
          <Typography
            id="modal-modal-title"
            variant="h6"
            component="h2"
            color="white"
          >
            Mint NFT
          </Typography>
          <Box
            component="form"
            noValidate
            autoComplete="off"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.target as HTMLFormElement);
              // TODO: Do something with the form data
            }}
          >
            <Grid container rowSpacing={2} paddingY={2}>
              <Grid item xs={12}>
                <TextField
                  name="description"
                  id="description"
                  label="description"
                  variant="outlined"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  name="store_location"
                  id="store_location"
                  label="store location"
                  variant="outlined"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  name="supply"
                  id="supply"
                  label="supply"
                  variant="outlined"
                  fullWidth
                />
              </Grid>
              <Grid item xs={12}>
                <Typography>Estimated costs: {cost}</Typography>
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" type="submit">
                  Mint
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </Modal>
    </div>
  );
};
