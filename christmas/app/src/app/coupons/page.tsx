"use client";

import React, { useState, useEffect } from "react";
import { useQuery } from "react-query";
import CouponCard from "../market/components/couponCard";
import CouponModal from "../market/components/couponModal";
import { fetchClaimedCoupons } from "../queries/queries";
import { useAnchorClient } from "@/providers/anchorClientProvider";
import { Coupon } from "@/types";
import { redeemCoupon } from "../queries/queries";
import { useQueryClient } from "react-query";

export default function Page() {
    const anchorClient = useAnchorClient();
    const queryClient = useQueryClient();
    const [selectedCoupon, setSelectedCoupon] = useState<null | Coupon>(null);

    // fetch claimed coupons
    const {
        data: couponsBalance,
        isLoading,
        refetch,
    } = useQuery(["claimed_coupons"], () => {
        if (anchorClient !== null) {
            return fetchClaimedCoupons(anchorClient);
        }
    });

    // refetch claimed coupons as anchorClient might be null initially
    useEffect(() => {
        refetch();
    }, [anchorClient]);

    async function handleRedeemCoupon(coupon: Coupon) {
        try {
            if (anchorClient === null) throw new Error("anchorClient is null");
            await queryClient.fetchQuery({
                queryKey: ["redeemCoupon"],
                queryFn: () => {
                    return redeemCoupon(anchorClient, {
                        coupon: coupon.publicKey,
                        mint: coupon.account.mint,
                        numTokens: 1,
                    });
                },
                cacheTime: 0, // don't cache redeem coupon
            });
            console.log("Coupon redeemed:", coupon);
        } catch (error) {
            console.log(error);
        }
        refetch();
        setSelectedCoupon(null); // close modal
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Available Coupons</h1>
            {isLoading ? (
                <p>Loading coupons...</p>
            ) : (
                <>
                    {couponsBalance?.map(([coupon, balance]) => (
                        <CouponCard
                            key={coupon.publicKey.toString()}
                            coupon={coupon}
                            balance={balance}
                            onClick={() => setSelectedCoupon(coupon)}
                        />
                    ))}
                </>
            )}
            {selectedCoupon && (
                <CouponModal
                    coupon={selectedCoupon}
                    onClose={() => setSelectedCoupon(null)}
                    onRedeem={handleRedeemCoupon}
                />
            )}
        </div>
    );
}
