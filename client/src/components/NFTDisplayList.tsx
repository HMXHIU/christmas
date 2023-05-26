import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  Grid,
  Modal,
  Typography,
} from "@mui/material";
import { ReactNode, useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { useLocation, useNavigate } from "react-router-dom";
import { modalStyle } from "../App";

type NFT = {
  name: string;
  pubkey: string;
  description: string;
  storeLocation: string;
  supplied: number;
  maxSupply: number;
  type: "personal" | "store" | "market";
};

const useNFTList = () => {
  return [
    {
      name: "NFT 1",
      pubkey: "123",
      description: "This is a description",
      storeLocation: "my house",
      supplied: 1,
      maxSupply: 1,
    },
    {
      name: "NFT 2",
      pubkey: "1234",
      description: "This is a 2 description",
      storeLocation: "my hous 2 e",
      supplied: 100,
      maxSupply: 1000,
    },
    {
      name: "NFT 3",
      pubkey: "12345",
      description: "This is a 3 description",
      storeLocation: "my hous 3 e",
      supplied: 100,
      maxSupply: 1000,
    },
  ];
};

export const NFTDisplayList = ({
  type,
}: {
  type: "personal" | "store" | "market";
}) => {
  const nftList = useNFTList();

  return (
    <Grid container columnSpacing={2} rowSpacing={2}>
      {nftList.map((nft) => (
        <Grid item xs={12} sm={12} md={4} key={nft.pubkey}>
          <NFTDisplayCard {...{ ...nft, type: type }} />
        </Grid>
      ))}
    </Grid>
  );
};

const NFTDisplayCard = (nft: NFT) => {
  const { name, description, supplied, maxSupply, type } = nft;
  const NFTCard = (
    <Card title={name} variant="outlined">
      <CardMedia
        sx={{ height: 200 }}
        image="https://picsum.photos/200"
        title={nft.pubkey}
      />
      <CardContent>
        <Typography gutterBottom variant="h5" component="div">
          {name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {description}
        </Typography>
        <Typography variant="body2" color="text.">
          {supplied} / {maxSupply}
        </Typography>
      </CardContent>
    </Card>
  );
  // TODO: calculated cost
  if (type === "personal") {
    return <NFTClaimModalWrapper nft={nft}>{NFTCard}</NFTClaimModalWrapper>;
  } else if (type === "store") {
    return (
      <NFTQRCodeDisplayModalWrapper nft={nft}>
        {NFTCard}
      </NFTQRCodeDisplayModalWrapper>
    );
  } else {
    return <>{NFTCard}</>;
  }
};

const NFTClaimModalWrapper = ({
  children,
  nft,
}: {
  children: ReactNode;
  nft: NFT;
}) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    navigate("/my-nfts");
  };

  const location = useLocation().pathname.split("/");
  const id = location[location.length - 1];

  useEffect(() => {
    // Check if the extracted ID matches the expected value
    if (id === nft.pubkey && !open) {
      handleOpen();
    }
  });

  return (
    <>
      <div onClick={handleOpen}>{children}</div>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={modalStyle}>
          <Card>
            <Typography id="modal-modal-title" variant="h6" component="h2">
              {nft.name}
            </Typography>
          </Card>
          {id === nft.pubkey ? <Button>Claim</Button> : null}
        </Box>
      </Modal>
    </>
  );
};

interface NFTQRCodeDisplayModalWrapperProps {
  children: ReactNode;
  nft: NFT;
}

const NFTQRCodeDisplayModalWrapper = ({
  children,
  nft,
}: NFTQRCodeDisplayModalWrapperProps) => {
  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // @ts-ignore
  return (
    <>
      <div onClick={handleOpen}>{children}</div>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={modalStyle}>
          {/* @ts-ignore */}
          <QRCode
            size={500}
            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
            value={nft.pubkey}
            viewBox="0 0 500 500"
          />
        </Box>
      </Modal>
    </>
  );
};
