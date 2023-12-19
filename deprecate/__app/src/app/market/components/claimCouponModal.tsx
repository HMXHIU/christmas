import React, { useRef, useEffect, useState } from "react";
import { Coupon } from "@/types";
import { useQuery } from "react-query";
import { fetchCouponMetadata } from "../../queries/queries";
import { nft_uri_to_url } from "@/lib/utils";

interface ClaimCouponModalProps {
    coupon: Coupon;
    onClose: () => void;
    onClaim: (coupon: Coupon) => void;
}

const ClaimCouponModal: React.FC<ClaimCouponModalProps> = ({
    coupon,
    onClose,
    onClaim,
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
        <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center bg-black bg-opacity-50">
            <div className="bg-white p-8 rounded-lg max-w-md relative">
                <button
                    className="close-button absolute top-4 right-4"
                    onClick={onClose}
                >
                    Close
                </button>

                <p className="text-center mt-4">{coupon.account.name}</p>

                {imageUrl && (
                    <img
                        src={imageUrl}
                        alt="Coupon"
                        className="w-40 h-40 object-cover rounded-md mx-auto"
                    />
                )}

                <p className="text-center mt-4">{metadata?.description}</p>

                <div className="flex justify-center mt-6">
                    <button
                        className="px-4 py-2 bg-green-500 text-white rounded-md mr-2"
                        onClick={() => onClaim(coupon)}
                    >
                        Claim Coupon
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClaimCouponModal;
