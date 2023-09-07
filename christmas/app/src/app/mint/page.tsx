"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "react-query";
import CouponCard from "../market/components/couponCard";

import {
    fetchMintedCoupons,
    createCoupon,
    CreateCoupon,
    mintCoupon,
    MintCoupon,
} from "../queries/queries";
import CreateCouponModal from "./components/createCouponModal";
import MintCouponModal from "./components/mintCouponModal";
import { useAnchorClient } from "@/providers/anchorClientProvider";
import { Coupon } from "@/types";
import { useQueryClient } from "react-query";

export default function Page() {
    const anchorClient = useAnchorClient();

    const queryClient = useQueryClient();
    const [isCreateCouponModalOpen, setIsCreateCouponModalOpen] =
        useState(false);
    const [isMintCouponModalOpen, setIsMintCouponModalOpen] = useState(false);
    const [selectedCoupon, setSelectedCoupon] = useState<null | Coupon>(null);

    async function handleCreateCoupon(formData: CreateCoupon) {
        console.log("Creating coupon with data:", formData);
        try {
            if (anchorClient === null) throw new Error("anchorClient is null");
            if (formData === null) throw new Error("formData is null");
            await queryClient.fetchQuery({
                queryKey: ["create_coupon"],
                queryFn: () => {
                    return createCoupon(anchorClient, formData);
                },
                cacheTime: 0, // don't cache coupon creation
            });
        } catch (error) {
            console.log(error);
        }
        setIsCreateCouponModalOpen(false);
    }

    // fetch coupons created by user
    const {
        data: mintedCoupons,
        isLoading,
        refetch,
    } = useQuery(["minted_coupons"], () => {
        if (anchorClient !== null) {
            return fetchMintedCoupons(anchorClient);
        }
    });

    // refetch minted coupons as anchorClient might be null initially
    useEffect(() => {
        refetch();
    }, [anchorClient]);

    async function handleMintCoupon(formData: MintCoupon) {
        console.log("Coupon minted:", selectedCoupon, formData);

        try {
            await queryClient.fetchQuery({
                queryKey: ["mint_coupon"],
                queryFn: () => {
                    if (anchorClient === null)
                        throw new Error("anchorClient is null");
                    if (formData === null) throw new Error("formData is null");
                    return mintCoupon(anchorClient, formData);
                },
            });
        } catch (error) {
            console.log(error);
        } finally {
            setSelectedCoupon(null);
            setIsMintCouponModalOpen(false);
        }
    }

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Minted Coupons</h1>

            <div className="container mx-auto mt-8 text-center">
                <button
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                    onClick={() => setIsCreateCouponModalOpen(true)}
                >
                    Mint Coupon
                </button>
                {isCreateCouponModalOpen && (
                    <CreateCouponModal
                        onClose={() => setIsCreateCouponModalOpen(false)}
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
                            onClick={() => {
                                setSelectedCoupon(coupon);
                                setIsMintCouponModalOpen(true);
                            }}
                        />
                    ))}
                </>
            )}
            {selectedCoupon && isMintCouponModalOpen && (
                <MintCouponModal
                    coupon={selectedCoupon}
                    onClose={() => {
                        setSelectedCoupon(null);
                        setIsMintCouponModalOpen(false);
                    }}
                    onMint={handleMintCoupon}
                />
            )}
        </div>
    );
}
