import { useEffect, useState } from "react";
import {
  BottomNavigation,
  BottomNavigationAction,
  Grid,
  Paper,
  Typography,
} from "@mui/material";
import {
  PoolOutlined,
  StoreMallDirectoryOutlined,
  StarOutline,
} from "@mui/icons-material";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

export const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeIndex, setActiveIndex] = useState<string | null>(null);

  const handleChange = (event: any, newValue: any) => {
    setActiveIndex(newValue);
  };

  // Detect the URL and set the key on load
  useEffect(() => {
    if (activeIndex === null) {
      switch (location.pathname) {
        case "/":
          setActiveIndex("Pool");
          break;
        case "/my-store":
          setActiveIndex("My Store");
          break;
        case "/my-nfts":
          setActiveIndex("My NFTs");
          break;
      }
    }
  }, [location, activeIndex]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh", // Change height to "100vh" for full screen height
      }}
    >
      <Grid
        container
        spacing={2}
        paddingX={2}
        paddingY={2}
        style={{ overflow: "auto", flex: 1 }} // Add "flex: 1" to expand Grid
      >
        <Grid item xs={12}>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignContent: "center",
            }}
          >
            <Typography variant="h5" color="white">
              {activeIndex}
            </Typography>
            <div style={{ flex: 1 }}>
              <WalletMultiButton style={{ float: "right" }} />
            </div>
          </div>
        </Grid>

        <Grid item xs={12}>
          <Outlet />
        </Grid>
      </Grid>
      <Paper
        sx={{
          position: "sticky",
          bottom: 0,
          left: 0,
          right: 0,
        }}
        elevation={3}
      >
        <BottomNavigation
          showLabels
          value={activeIndex}
          onChange={handleChange}
          className="sticky-bottom-navigation"
        >
          <BottomNavigationAction
            value="Pool"
            label="Pool"
            icon={<PoolOutlined />}
            onClick={() => {
              navigate("/");
            }}
          />

          <BottomNavigationAction
            label="My store"
            value="My store"
            icon={<StoreMallDirectoryOutlined />}
            onClick={() => {
              navigate("/my-store");
            }}
          />
          <BottomNavigationAction
            value="My NFTs"
            label="My NFTs"
            icon={<StarOutline />}
            onClick={() => {
              navigate("/my-nfts");
            }}
          />
        </BottomNavigation>
      </Paper>
    </div>
  );
};
