import React, { FC, ReactNode, useMemo, useEffect } from "react";
import ReactDOM from "react-dom/client";
import { LitElement, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import retargetEvents from "react-shadow-dom-retarget-events";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
  useAnchorWallet,
  useConnection,
  Wallet,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  WalletMultiButton,
  WalletDisconnectButton,
} from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

// Need to import the styles for the modal (not in shadowroot)
require("@solana/wallet-adapter-react-ui/styles.css");

const SolanaReactWalletProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'. (TODO: set this in config)
  const network = WalletAdapterNetwork.Devnet;

  // const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  const endpoint = "http://127.0.0.1:8899"; // TODO: make configurable

  const wallets = useMemo(() => [new PhantomWalletAdapter()], [network]);

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

const SolanaWalletButton: FC<{
  children: ReactNode;
  onConnectWallet: (wallet: Wallet) => void;
  onDisconnectWallet: () => void;
}> = ({ children, onConnectWallet, onDisconnectWallet }) => {
  const { connected } = useWallet();
  const { wallet, publicKey } = useWallet();
  const anchorWallet = useAnchorWallet();
  const { connection } = useConnection();

  useEffect(() => {
    if (anchorWallet && publicKey && connection && connected && wallet) {
      onConnectWallet(wallet);
    } else if (!connected) {
      onDisconnectWallet();
    }
  }, [wallet, publicKey, connection, anchorWallet, connected]);

  return connected
    ? React.createElement(WalletDisconnectButton)
    : React.createElement(WalletMultiButton);
};

@customElement("solana-wallet")
export class SolanaWallet extends LitElement {
  mountPoint?: HTMLElement;

  @property({ type: Boolean })
  isConnected = false;

  // copy from @solana/wallet-adapter-react-ui/styles.css, https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&display=swap
  static styles = css`
    /* latin-ext */
    @font-face {
      font-family: "DM Sans";
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/dmsans/v14/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu6-K6z9mXgjU0.woff2)
        format("woff2");
      unicode-range: U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F,
        U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F,
        U+A720-A7FF;
    }
    /* latin */
    @font-face {
      font-family: "DM Sans";
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/dmsans/v14/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu0-K6z9mXg.woff2)
        format("woff2");
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6,
        U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC,
        U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
    /* latin-ext */
    @font-face {
      font-family: "DM Sans";
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/dmsans/v14/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu6-K6z9mXgjU0.woff2)
        format("woff2");
      unicode-range: U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F,
        U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F,
        U+A720-A7FF;
    }
    /* latin */
    @font-face {
      font-family: "DM Sans";
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/dmsans/v14/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu0-K6z9mXg.woff2)
        format("woff2");
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6,
        U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC,
        U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
    /* latin-ext */
    @font-face {
      font-family: "DM Sans";
      font-style: normal;
      font-weight: 700;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/dmsans/v14/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu6-K6z9mXgjU0.woff2)
        format("woff2");
      unicode-range: U+0100-02AF, U+0304, U+0308, U+0329, U+1E00-1E9F,
        U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20CF, U+2113, U+2C60-2C7F,
        U+A720-A7FF;
    }
    /* latin */
    @font-face {
      font-family: "DM Sans";
      font-style: normal;
      font-weight: 700;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/dmsans/v14/rP2Yp2ywxg089UriI5-g4vlH9VoD8Cmcqbu0-K6z9mXg.woff2)
        format("woff2");
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6,
        U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC,
        U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }

    .wallet-adapter-button {
      background-color: transparent;
      border: none;
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      font-family: "DM Sans", "Roboto", "Helvetica Neue", Helvetica, Arial,
        sans-serif;
      font-size: 16px;
      font-weight: 600;
      height: 48px;
      line-height: 48px;
      padding: 0 24px;
      border-radius: 4px;
    }

    .wallet-adapter-button-trigger {
      background-color: #512da8;
    }

    .wallet-adapter-button:not([disabled]):focus-visible {
      outline-color: white;
    }

    .wallet-adapter-button:not([disabled]):hover {
      background-color: #1a1f2e;
    }

    .wallet-adapter-button[disabled] {
      background: #404144;
      color: #999;
      cursor: not-allowed;
    }

    .wallet-adapter-button-end-icon,
    .wallet-adapter-button-start-icon,
    .wallet-adapter-button-end-icon img,
    .wallet-adapter-button-start-icon img {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
    }

    .wallet-adapter-button-end-icon {
      margin-left: 12px;
    }

    .wallet-adapter-button-start-icon {
      margin-right: 12px;
    }

    .wallet-adapter-collapse {
      width: 100%;
    }

    .wallet-adapter-dropdown {
      position: relative;
      display: inline-block;
    }

    .wallet-adapter-dropdown-list {
      position: absolute;
      z-index: 99;
      display: grid;
      grid-template-rows: 1fr;
      grid-row-gap: 10px;
      padding: 10px;
      top: 100%;
      right: 0;
      margin: 0;
      list-style: none;
      background: #2c2d30;
      border-radius: 10px;
      box-shadow: 0px 8px 20px rgba(0, 0, 0, 0.6);
      opacity: 0;
      visibility: hidden;
      transition: opacity 200ms ease, transform 200ms ease, visibility 200ms;
      font-family: "DM Sans", "Roboto", "Helvetica Neue", Helvetica, Arial,
        sans-serif;
    }

    .wallet-adapter-dropdown-list-active {
      opacity: 1;
      visibility: visible;
      transform: translateY(10px);
    }

    .wallet-adapter-dropdown-list-item {
      display: flex;
      flex-direction: row;
      justify-content: center;
      align-items: center;
      border: none;
      outline: none;
      cursor: pointer;
      white-space: nowrap;
      box-sizing: border-box;
      padding: 0 20px;
      width: 100%;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      height: 37px;
      color: #fff;
    }

    .wallet-adapter-dropdown-list-item:not([disabled]):hover {
      background-color: #1a1f2e;
    }

    .wallet-adapter-modal-collapse-button svg {
      align-self: center;
      fill: #999;
    }

    .wallet-adapter-modal-collapse-button.wallet-adapter-modal-collapse-button-active
      svg {
      transform: rotate(180deg);
      transition: transform ease-in 150ms;
    }

    .wallet-adapter-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      opacity: 0;
      transition: opacity linear 150ms;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1040;
      overflow-y: auto;
    }

    .wallet-adapter-modal.wallet-adapter-modal-fade-in {
      opacity: 1;
    }

    .wallet-adapter-modal-button-close {
      display: flex;
      align-items: center;
      justify-content: center;
      position: absolute;
      top: 18px;
      right: 18px;
      padding: 12px;
      cursor: pointer;
      background: #1a1f2e;
      border: none;
      border-radius: 50%;
    }

    .wallet-adapter-modal-button-close:focus-visible {
      outline-color: white;
    }

    .wallet-adapter-modal-button-close svg {
      fill: #777;
      transition: fill 200ms ease 0s;
    }

    .wallet-adapter-modal-button-close:hover svg {
      fill: #fff;
    }

    .wallet-adapter-modal-overlay {
      background: rgba(0, 0, 0, 0.5);
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      right: 0;
    }

    .wallet-adapter-modal-container {
      display: flex;
      margin: 3rem;
      min-height: calc(100vh - 6rem); /* 100vh - 2 * margin */
      align-items: center;
      justify-content: center;
    }

    @media (max-width: 480px) {
      .wallet-adapter-modal-container {
        margin: 1rem;
        min-height: calc(100vh - 2rem); /* 100vh - 2 * margin */
      }
    }

    .wallet-adapter-modal-wrapper {
      box-sizing: border-box;
      position: relative;
      display: flex;
      align-items: center;
      flex-direction: column;
      z-index: 1050;
      max-width: 400px;
      border-radius: 10px;
      background: #10141f;
      box-shadow: 0px 8px 20px rgba(0, 0, 0, 0.6);
      font-family: "DM Sans", "Roboto", "Helvetica Neue", Helvetica, Arial,
        sans-serif;
      flex: 1;
    }

    .wallet-adapter-modal-wrapper .wallet-adapter-button {
      width: 100%;
    }

    .wallet-adapter-modal-title {
      font-weight: 500;
      font-size: 24px;
      line-height: 36px;
      margin: 0;
      padding: 64px 48px 48px 48px;
      text-align: center;
      color: #fff;
    }

    @media (max-width: 374px) {
      .wallet-adapter-modal-title {
        font-size: 18px;
      }
    }

    .wallet-adapter-modal-list {
      margin: 0 0 12px 0;
      padding: 0;
      width: 100%;
      list-style: none;
    }

    .wallet-adapter-modal-list .wallet-adapter-button {
      font-weight: 400;
      border-radius: 0;
      font-size: 18px;
    }

    .wallet-adapter-modal-list .wallet-adapter-button-end-icon,
    .wallet-adapter-modal-list .wallet-adapter-button-start-icon,
    .wallet-adapter-modal-list .wallet-adapter-button-end-icon img,
    .wallet-adapter-modal-list .wallet-adapter-button-start-icon img {
      width: 28px;
      height: 28px;
    }

    .wallet-adapter-modal-list .wallet-adapter-button span {
      margin-left: auto;
      font-size: 14px;
      opacity: 0.6;
    }

    .wallet-adapter-modal-list-more {
      cursor: pointer;
      border: none;
      padding: 12px 24px 24px 12px;
      align-self: flex-end;
      display: flex;
      align-items: center;
      background-color: transparent;
      color: #fff;
    }

    .wallet-adapter-modal-list-more svg {
      transition: all 0.1s ease;
      fill: rgba(255, 255, 255, 1);
      margin-left: 0.5rem;
    }

    .wallet-adapter-modal-list-more-icon-rotate {
      transform: rotate(180deg);
    }

    .wallet-adapter-modal-middle {
      width: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0 24px 24px 24px;
      box-sizing: border-box;
    }

    .wallet-adapter-modal-middle-button {
      display: block;
      cursor: pointer;
      margin-top: 48px;
      width: 100%;
      background-color: #512da8;
      padding: 12px;
      font-size: 18px;
      border: none;
      border-radius: 8px;
      color: #fff;
    }
  `;

  onConnectWallet(wallet: Wallet) {
    this.isConnected = true;
    this.dispatchEvent(
      new CustomEvent("on-connect-wallet", {
        bubbles: true,
        composed: true,
        detail: { wallet },
      })
    );
  }
  onDisconnectWallet() {
    this.isConnected = false;
    this.dispatchEvent(
      new CustomEvent("on-disconnect-wallet", {
        bubbles: true,
        composed: true,
        detail: {},
      })
    );
  }

  connectedCallback() {
    super.connectedCallback();

    this.mountPoint = document.createElement("span");

    if (this.shadowRoot) {
      this.shadowRoot.appendChild(this.mountPoint);
      retargetEvents(this.shadowRoot);
    }

    ReactDOM.createRoot(this.mountPoint).render(
      React.createElement(SolanaReactWalletProvider, {
        children: React.createElement(SolanaWalletButton, {
          onConnectWallet: this.onConnectWallet.bind(this),
          onDisconnectWallet: this.onDisconnectWallet.bind(this),
          children: null,
        }),
      })
    );
  }
}
