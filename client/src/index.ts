// shoelace
import "@shoelace-style/shoelace/dist/themes/light.css";
import "@shoelace-style/shoelace/dist/components/button/button.js";
import "@shoelace-style/shoelace/dist/components/icon/icon.js";
import "@shoelace-style/shoelace/dist/components/input/input.js";
import "@shoelace-style/shoelace/dist/components/rating/rating.js";
import "@shoelace-style/shoelace/dist/components/card/card.js";
import "@shoelace-style/shoelace/dist/components/dialog/dialog.js";
import "@shoelace-style/shoelace/dist/components/textarea/textarea.js";
import "@shoelace-style/shoelace/dist/components/option/option.js";
import "@shoelace-style/shoelace/dist/components/select/select.js";
import "@shoelace-style/shoelace/dist/components/checkbox/checkbox.js";
import "@shoelace-style/shoelace/dist/components/carousel/carousel.js";
import "@shoelace-style/shoelace/dist/components/carousel-item/carousel-item.js";
import "@shoelace-style/shoelace/dist/components/tooltip/tooltip.js";
import "@shoelace-style/shoelace/dist/components/icon-button/icon-button.js";

import { setBasePath } from "@shoelace-style/shoelace/dist/utilities/base-path.js";
setBasePath("shoelace");

// app-layout
import "@polymer/app-layout/app-layout.js";

// custom
import "./components/solana-wallet";
import "./components/coupon-card";
import "./components/mint-coupon-card";
import "./components/create-coupon-dialog";
import "./components/mint-coupon-dialog";
import "./components/image-input";
import "./layouts/app-main";
import "./layouts/app-footer";
import "./pages/coupons-page";
import "./pages/mint-page";
import "./pages/onboard-wallet-page";
