import * as React from "react";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { Box, Card, Grid, Modal } from "@mui/material";
import { modalStyle } from "../../App";

enum ContributionAmount {
  FIVE = "$5",
  TEN = "$10",
  TWENTY = "$20",
  FIFTY = "$50",
  CUSTOM = "CUSTOM",
  NONE = "NONE",
}

export const AddToPoolModal = () => {
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const [selected, setSelected] = React.useState<ContributionAmount>(
    ContributionAmount.NONE
  );

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
          <Typography color="white">Contribute to the pool</Typography>
          <Grid container rowSpacing={2} columnSpacing={2} paddingY={2}>
            {Object.values(ContributionAmount)
              .filter(
                (val) =>
                  val !== ContributionAmount.CUSTOM &&
                  val !== ContributionAmount.NONE
              )
              .map((val) => {
                const isSelected = val === selected; // Check if the current value is selected
                return (
                  <Grid item xs={6}>
                    <Card
                      variant="outlined"
                      onClick={() => {
                        if (isSelected) {
                          setSelected(ContributionAmount.NONE);
                        } else {
                          setSelected(val);
                        }
                      }} // Use onClick instead of onSelect
                      sx={{
                        backgroundColor: isSelected ? "success.main" : "",
                      }}
                    >
                      <Typography id="modal-modal-description" sx={{ mt: 2 }}>
                        {val}
                      </Typography>
                    </Card>
                  </Grid>
                );
              })}

            <Grid item xs={12}>
              <Button
                variant="contained"
                disabled={selected === ContributionAmount.NONE}
                color="info"
              >
                Confirm
              </Button>
              {selected !== ContributionAmount.NONE ? (
                <Button
                  variant="contained"
                  color="error"
                  onClick={() => setSelected(ContributionAmount.NONE)}
                  style={{ marginLeft: 4 }}
                >
                  Cancel
                </Button>
              ) : null}
            </Grid>
          </Grid>
        </Box>
      </Modal>
    </div>
  );
};
