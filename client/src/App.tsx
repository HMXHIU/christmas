import React, { FC } from "react";
import WalletProvider from "./providers/wallet";

import { ThemeProvider } from "@emotion/react";
import { createTheme } from "@mui/material";
import { Layout } from "./components/layout";
import "./App.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Pool } from "./view/pool";
import { Store } from "./view/store";
import { PersonalNFTs } from "./view/personalnfts";
import { Marketplace } from "./view/marketplace";

// need this if not it will complain missing buffer
window.Buffer = window.Buffer || require("buffer").Buffer;

declare module "@mui/material/styles" {
  interface Theme {
    status: {
      danger: string;
    };
  }
  // allow configuration using `createTheme`
  interface ThemeOptions {
    status?: {
      danger?: string;
    };
  }
}

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#C1A050",
      light: "#ff8a65",
      dark: "#C1A050",
    },
    secondary: {
      main: "#4caf50",
      light: "#68d191",
      dark: "#38b27a",
    },
    error: {
      main: "#d94b37",
      light: "#e46c4b",
      dark: "#b9382e",
    },
    info: {
      main: "#2196f3",
      light: "#32bcf6",
      dark: "#1976d2",
    },
    success: {
      main: "#4caf50",
      light: "#68d191",
      dark: "#38b27a",
    },
    warning: {
      main: "#ffc107",
      light: "#ffecb3",
      dark: "#e68a14",
    },
  },
  typography: {
    h1: {
      fontSize: "24px",
      fontWeight: "700",
    },
    h2: {
      fontSize: "20px",
      fontWeight: "500",
    },
    h3: {
      fontSize: "16px",
      fontWeight: "400",
    },
  },
  components: {
    MuiButtonBase: {
      defaultProps: {
        color: "primary",
      },
    },
    MuiBottomNavigation: {
      defaultProps: {
        color: "primary.main",
      },
    },
  },
});

export const modalStyle = {
  position: "absolute" as "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
};

const router = createBrowserRouter([
  {
    path: "*",
    element: <Layout />,
    children: [
      {
        path: "",
        element: <Pool />,
      },
      {
        path: "my-store",
        element: <Store />,
      },
      {
        path: "my-nfts/*",
        element: <PersonalNFTs />,
      },
      {
        path: "marketplace",
        element: <Marketplace />,
      },
    ],
  },
]);

const App: FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <WalletProvider>
        <RouterProvider router={router} />
      </WalletProvider>
    </ThemeProvider>
  );
};

export default App;
