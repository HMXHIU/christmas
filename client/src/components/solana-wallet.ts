import React, { FC, ReactNode, useMemo } from "react";
import ReactDOM from "react-dom/client";

import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import retargetEvents from "react-shadow-dom-retarget-events";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  WalletMultiButton,
  WalletDisconnectButton,
} from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

// Default styles that can be overridden by your app
require("@solana/wallet-adapter-react-ui/styles.css");

const SolanaReactWalletProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'. (TODO: set this in config)
  const network = WalletAdapterNetwork.Devnet;

  // You can also provide a custom RPC endpoint.
  // const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const endpoint = "http://127.0.0.1:8899"; // TODO: make configurable

  const wallets = useMemo(
    () => [new PhantomWalletAdapter()],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [network]
  );

  return React.createElement(ConnectionProvider, {
    endpoint: endpoint,
    children: React.createElement(WalletProvider, {
      wallets: wallets,
      autoConnect: true,
      children: React.createElement(WalletModalProvider, {
        children: children,
      }),
    }),
  });
};

const SolanaWalletButton: FC<{ children: ReactNode }> = ({ children }) => {
  const { connected } = useWallet();

  return connected
    ? React.createElement(WalletDisconnectButton)
    : React.createElement(WalletMultiButton);
};

@customElement("solana-wallet")
export class SolanaWallet extends LitElement {
  mountPoint?: HTMLElement;

  connectedCallback() {
    super.connectedCallback();

    this.mountPoint = document.createElement("span");

    if (this.shadowRoot) {
      this.shadowRoot.appendChild(this.mountPoint);
      retargetEvents(this.shadowRoot);
    }

    ReactDOM.createRoot(this.mountPoint).render(
      React.createElement(SolanaReactWalletProvider, {
        children: React.createElement(SolanaWalletButton),
      })
    );
  }
}
