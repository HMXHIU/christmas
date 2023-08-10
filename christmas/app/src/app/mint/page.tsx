"use client";

import React, { useState } from "react";
import { useQuery } from "react-query";
import CouponCard from "../market/components/couponCard";
import CouponModal from "../market/components/couponModal";
import {
    fetchMintedCoupons,
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
        console.log("Creating coupon with data:", formData);

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

    const { data: mintedCoupons, isLoading } = useQuery(
        ["minted_coupons"],
        () => {
            if (anchorClient !== null) {
                return fetchMintedCoupons(anchorClient);
            }
        }
    );

    const [selectedCoupon, setSelectedCoupon] = useState<null | Coupon>(null);

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
            <h1 className="text-2xl font-bold mb-4">Minted Coupons</h1>

            <div className="container mx-auto mt-8 text-center">
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
                    {mintedCoupons?.map(([coupon, supply, balance]) => (
                        <CouponCard
                            key={coupon.publicKey.toString()}
                            coupon={coupon}
                            supply={supply}
                            balance={balance}
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
