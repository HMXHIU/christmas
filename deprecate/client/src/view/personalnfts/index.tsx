import { NFTDisplayList } from "../../components/NFTDisplayList";

import Main from "../main"

const PersonalNFTComponent = ({ nftList }) => (
  <NFTDisplayList type="personal" nftList={nftList} />
);

export const PersonalNFTs = () => {
  return (
    <Main>
      <PersonalNFTComponent />
    </Main>
  );
};
