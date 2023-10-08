"use client";

import React, { useEffect, useState } from "react";
import { useQuery } from "react-query";
import CouponCard from "../market/components/couponCard";
import { PublicKey } from "@solana/web3.js";
import {
    fetchMintedCoupons,
    createCoupon,
    CreateCoupon,
    mintCoupon,
    MintCoupon,
} from "../queries/queries";
import CreateCouponModal from "./components/createCouponModal";
import MintCouponModal from "./components/mintCouponModal";
import VerifyRedemptionModal from "./components/verifyRedemptionModal";
import { useAnchorClient } from "@/providers/anchorClientProvider";
import { useNftStorageClient } from "@/providers/nftStorageClientProvider";
import { Coupon } from "@/types";
import { useQueryClient } from "react-query";
import { extractQueryParams } from "../../lib/utils";
import { read } from "fs";

export default function Page() {
    const anchorClient = useAnchorClient();
    const nftStorageClient = useNftStorageClient();
    const queryClient = useQueryClient();
    const [isCreateCouponModalOpen, setIsCreateCouponModalOpen] =
        useState(false);
    const [isMintCouponModalOpen, setIsMintCouponModalOpen] = useState(false);
    const [isVerifyRedemptionModalOpen, setIsVerifyRedemptionModalOpen] =
        useState(false);
    const [selectedCoupon, setSelectedCoupon] = useState<null | Coupon>(null);
    const [verifyRedemptionStatus, setVerifyRedemptionStatus] = useState<{
        isVerified: boolean | null;
        err: string | null;
    }>({
        isVerified: null,
        err: null,
    });

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

    async function handleCreateCoupon(formData: CreateCoupon) {
        console.log("Creating coupon with data:", formData);
        try {
            if (anchorClient === null) throw new Error("anchorClient is null");
            if (nftStorageClient === null)
                throw new Error("nftStorageClient is null");
            if (formData === null) throw new Error("formData is null");

            // upload the coupon metadata to nft storage
            if (formData.image) {
                const nftUrl = await nftStorageClient.store({
                    name: formData.name,
                    description: formData.description,
                    imageFile: formData.image,
                });
                console.log(`NFT URL: ${nftUrl}`);
            }

            // create the coupon on the blockchain
            await queryClient.fetchQuery({
                queryKey: ["create_coupon"],
                queryFn: () => {
                    return createCoupon(anchorClient, formData);
                },
                cacheTime: 0, // don't cache coupon creation
            });
        } catch (error) {
            console.log(error);
        } finally {
            refetch();
        }
        setIsCreateCouponModalOpen(false);
    }

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
            refetch();
        }
    }

    async function handleVerifyRedemption(redemptionQRCodeURL: string) {
        console.log(`redemptionQRCodeURL: ${redemptionQRCodeURL}`);
        try {
            if (anchorClient === null) throw new Error("anchorClient is null");

            // test extract redemption parameters
            const redemptionParams = extractQueryParams(redemptionQRCodeURL);

            // test verify redemption
            const redemptionStatus = await anchorClient.verifyRedemption({
                signature: redemptionParams.signature,
                wallet: new PublicKey(redemptionParams.wallet),
                mint: new PublicKey(redemptionParams.mint),
                numTokens: parseInt(redemptionParams.numTokens),
            });

            setVerifyRedemptionStatus(redemptionStatus);
        } catch (error) {
            setVerifyRedemptionStatus({
                isVerified: false,
                err: "Invalid Remdeption Code",
            });
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
                    Create Coupon
                </button>

                <button
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                    onClick={() => setIsVerifyRedemptionModalOpen(true)}
                >
                    Verify Redemption
                </button>
            </div>

            {/* Minted Coupons */}
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

            {/* Create Coupon Modal */}
            {isCreateCouponModalOpen && (
                <CreateCouponModal
                    onClose={() => setIsCreateCouponModalOpen(false)}
                    onCreateCoupon={handleCreateCoupon}
                />
            )}

            {/* Mint Coupon Modal */}
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

            {/* Verify Redemption Modal */}
            {isVerifyRedemptionModalOpen && (
                <VerifyRedemptionModal
                    onClose={() => {
                        setIsVerifyRedemptionModalOpen(false);
                    }}
                    onQRCodeScan={handleVerifyRedemption}
                    verificationStatus={
                        verifyRedemptionStatus.isVerified
                            ? "Verified"
                            : verifyRedemptionStatus.err
                    }
                ></VerifyRedemptionModal>
            )}
        </div>
    );
}
