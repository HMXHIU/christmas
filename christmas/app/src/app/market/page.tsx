"use client";

import React, { useState } from "react";
import { useQuery } from "react-query";
import CouponCard from "./components/couponCard";
import CouponModal from "./components/couponModal";
import { fetchCoupons } from "./queries/couponQueries";

interface Coupon {
    id: string;
    image: string;
    description: string;
    detailedDescription: string;
}

export default function Page() {
    const [selectedCoupon, setSelectedCoupon] = useState<null | Coupon>(null);
    const { data: coupons, isLoading } = useQuery("coupons", fetchCoupons);

    const handleCouponClick = (coupon: Coupon) => {
        setSelectedCoupon(coupon);
    };

    const handleModalClose = () => {
        setSelectedCoupon(null);
    };

    const handleRedeemCoupon = () => {
        // Handle coupon redemption logic here
        console.log("Coupon redeemed:", selectedCoupon);
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Available Coupons</h1>
            {isLoading ? (
                <p>Loading coupons...</p>
            ) : (
                <>
                    {coupons.map((coupon: Coupon) => (
                        <CouponCard
                            key={coupon.id}
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
