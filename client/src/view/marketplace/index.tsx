import { NFTDisplayList } from "../../components/NFTDisplayList";

import Main from "../main"

const MarketplaceComponent = ({ nftList }) => (
  <NFTDisplayList type="market" nftList={nftList} />
);

export const Marketplace = () => {
  return (
    <Main>
      {/* @ts-ignore */}
      <MarketplaceComponent />
    </Main>
  );
};
