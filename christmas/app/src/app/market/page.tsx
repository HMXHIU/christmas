"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "react-query";
import CouponCard from "./components/couponCard";
import ClaimCouponModal from "./components/claimCouponModal";
import { fetchCoupons } from "../queries/queries";
import { useAnchorClient } from "@/providers/anchorClientProvider";
import { Coupon } from "@/types";

export default function Page() {
    const anchorClient = useAnchorClient();
    const queryClient = useQueryClient();

    const region = "SGP"; // TODO: Use user's location

    const [selectedCoupon, setSelectedCoupon] = useState<null | Coupon>(null);
    const {
        data: coupons,
        isLoading,
        refetch,
    } = useQuery(["coupons", region], () => {
        if (anchorClient !== null) {
            return fetchCoupons(anchorClient, region);
        }
    });

    // refetch market coupons as anchorClient might be null initially
    useEffect(() => {
        refetch();
    }, [anchorClient]);

    const handleCouponClick = (coupon: Coupon) => {
        setSelectedCoupon(coupon);
    };

    async function handleClaimCoupon() {
        console.log("Coupon redeemed:", selectedCoupon);
        if (anchorClient && selectedCoupon) {
            await anchorClient.claimFromMarket(selectedCoupon.account.mint, 1);
            queryClient.invalidateQueries(["coupons", region]);
        }
        setSelectedCoupon(null);
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Available Coupons</h1>
            {isLoading ? (
                <p>Loading coupons...</p>
            ) : (
                <>
                    {coupons?.map((coupon: Coupon) => (
                        <CouponCard
                            key={coupon.publicKey.toString()}
                            balance={parseInt(
                                coupon.tokenAccountData?.parsed?.info
                                    ?.tokenAmount.amount
                            )}
                            coupon={coupon}
                            onClick={() => handleCouponClick(coupon)}
                        />
                    ))}
                </>
            )}
            {selectedCoupon && (
                <ClaimCouponModal
                    coupon={selectedCoupon}
                    onClose={() => {
                        setSelectedCoupon(null);
                    }}
                    onClaim={handleClaimCoupon}
                />
            )}
        </div>
    );
}
