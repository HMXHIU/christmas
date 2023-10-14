import React, { useState, useEffect } from "react";
import { Coupon } from "@/types";
import { fetchCouponMetadata } from "../../queries/queries";
import { useQuery } from "react-query";
import { nft_uri_to_url } from "@/lib/utils";

interface CouponCardProps {
    coupon: Coupon;
    supply?: number;
    balance?: number;
    onClick: () => void;
}

const CouponCard: React.FC<CouponCardProps> = ({
    coupon,
    supply,
    balance,
    onClick,
}) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    // fetch coupon metadata
    const {
        data: metadata,
        isLoading,
        refetch,
    } = useQuery(
        ["coupon_metadata", coupon.publicKey],
        () => {
            return fetchCouponMetadata(coupon);
        },
        {
            onSuccess: (metadata) => {
                const url = nft_uri_to_url(metadata.image);
                setImageUrl(url);
            },
        }
    );

    return (
        <div className="border p-4 my-2 cursor-pointer" onClick={onClick}>
            <img
                src={imageUrl}
                alt="Coupon"
                className="w-24 h-24 object-cover rounded-md"
            />
            <p className="mt-2">name: {coupon.account.name}</p>
            <p className="mt-2">description: {metadata?.description}</p>
            <p className="mt-2">symbol: {coupon.account.symbol}</p>
            <p className="mt-2">region: {coupon.account.region}</p>
            <p className="mt-2">geo: {coupon.account.geo}</p>
            {supply !== undefined ? (
                <p className="mt-2">supply: {supply}</p>
            ) : null}
            {balance !== undefined ? (
                <p className="mt-2">balance: {balance}</p>
            ) : null}
        </div>
    );
};

export default CouponCard;
