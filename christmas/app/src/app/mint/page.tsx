"use client";

import React, { useState } from "react";
import { useQuery } from "react-query";
import CouponCard from "../market/components/couponCard";
import CouponModal from "../market/components/couponModal";
import {
    fetchClaimedCoupons,
    createCoupon,
    CreateCoupon,
} from "../queries/queries";
import CreateCouponModal from "./components/createCouponModal";
import { useAnchorClient } from "@/providers/anchorClientProvider";
import { Coupon } from "@/types";
import { useQueryClient } from "react-query";

export default function Page() {
    const anchorClient = useAnchorClient();

    const queryClient = useQueryClient();
    const [isCreateCouponModalOpen, setIsCreateCouponModalOpen] =
        useState(false);

    const handleOpenCreateCouponModal = () => {
        setIsCreateCouponModalOpen(true);
    };

    const handleCloseCreateCouponModal = () => {
        setIsCreateCouponModalOpen(false);
    };

    async function handleCreateCoupon(formData: CreateCoupon) {
        console.log("Minting coupon with data:", formData);

        try {
            await queryClient.fetchQuery({
                queryKey: ["create_coupon"],
                queryFn: () => {
                    if (anchorClient === null)
                        throw new Error("anchorClient is null");
                    if (formData === null) throw new Error("formData is null");
                    return createCoupon(anchorClient, formData);
                },
            });
        } catch (error) {
            console.log(error);
        }

        handleCloseCreateCouponModal();
    }

    const [selectedCoupon, setSelectedCoupon] = useState<null | Coupon>(null);
    const { data: couponsBalance, isLoading } = useQuery(
        ["claimed_coupons"],
        () => {
            if (anchorClient !== null) {
                return fetchClaimedCoupons(anchorClient);
            }
        }
    );

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

            <div className="container mx-auto mt-8 text-center">
                <h1 className="text-4xl font-bold mb-8">
                    Welcome to the Christmas Protocol Marketplace
                </h1>
                <button
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                    onClick={handleOpenCreateCouponModal}
                >
                    Mint Coupon
                </button>
                {isCreateCouponModalOpen && (
                    <CreateCouponModal
                        onClose={handleCloseCreateCouponModal}
                        onCreateCoupon={handleCreateCoupon}
                    />
                )}
            </div>

            {isLoading ? (
                <p>Loading coupons...</p>
            ) : (
                <>
                    {couponsBalance?.map(([coupon, number]) => (
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
