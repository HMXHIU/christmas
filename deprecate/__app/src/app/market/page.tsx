"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "react-query";
import CouponCard from "./components/couponCard";
import ClaimCouponModal from "./components/claimCouponModal";
import { fetchCoupons } from "../queries/queries";
import { useAnchorClient } from "@/providers/anchorClientProvider";
import { Coupon } from "@/types";
import { useClientDevice } from "@/providers/clientDeviceProvider";

export default function Page() {
    const anchorClient = useAnchorClient();
    const queryClient = useQueryClient();
    const clientDevice = useClientDevice();
    const [selectedCoupon, setSelectedCoupon] = useState<null | Coupon>(null);
    const region = clientDevice?.country?.code;

    // fetch coupons
    const {
        data: coupons,
        isLoading,
        refetch,
    } = useQuery(["coupons", region], () => {
        if (anchorClient && region) {
            return fetchCoupons(anchorClient, region);
        }
    });

    // refetch market coupons as anchorClient & clientDevice might be null initially
    useEffect(() => {
        refetch();
    }, [anchorClient, region]);

    const handleCouponClick = (coupon: Coupon) => {
        setSelectedCoupon(coupon);
    };

    async function handleClaimCoupon() {
        console.log("Coupon redeemed:", selectedCoupon);
        if (anchorClient && selectedCoupon) {
            await anchorClient.claimFromMarket(
                selectedCoupon.account.mint,
                1,
                clientDevice?.country?.code,
                clientDevice?.geohash
            );
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
