"use client";

import React, { useState } from "react";
import { useQuery, useQueryClient } from "react-query";
import CouponCard from "./components/couponCard";
import CouponModal from "./components/couponModal";
import { fetchCoupons } from "../queries/queries";
import { useAnchorClient } from "@/providers/anchorClientProvider";
import { Coupon } from "@/types";

export default function Page() {
    const anchorClient = useAnchorClient();
    const queryClient = useQueryClient();

    const region = "SGP"; // TODO: Use user's location

    const [selectedCoupon, setSelectedCoupon] = useState<null | Coupon>(null);
    const { data: coupons, isLoading } = useQuery(["coupons", region], () =>
        fetchCoupons(anchorClient, region)
    );

    const handleCouponClick = (coupon: Coupon) => {
        setSelectedCoupon(coupon);
    };

    const handleModalClose = () => {
        setSelectedCoupon(null);
    };

    async function handleRedeemCoupon() {
        // Handle coupon redemption logic here
        console.log("Coupon redeemed:", selectedCoupon);

        if (anchorClient && selectedCoupon) {
            const res = await anchorClient.claimFromMarket(
                selectedCoupon.account.mint,
                1
            );
            console.log(res);
            queryClient.invalidateQueries(["coupons", region]);
        }
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
                            coupon={coupon}
                            onClick={() => handleCouponClick(coupon)}
                        />
                    ))}
                </>
            )}
            {selectedCoupon && (
                <CouponModal
                    coupon={selectedCoupon}
                    onClose={handleModalClose}
                    onRedeem={handleRedeemCoupon}
                />
            )}
        </div>
    );
}