"use client";

import { useState } from "react";
import { useQueryClient } from "react-query";
import Image from "next/image";
import MintCouponModal from "./components/mintCouponModal";
import { createCoupon, CreateCoupon } from "./queries/queries";
import { useAnchorClient } from "@/providers/anchorClientProvider";

export default function Home() {
    const anchorClient = useAnchorClient();
    const queryClient = useQueryClient();
    const [isMintCouponModalOpen, setIsMintCouponModalOpen] = useState(false);

    const handleOpenMintCouponModal = () => {
        setIsMintCouponModalOpen(true);
    };

    const handleCloseMintCouponModal = () => {
        setIsMintCouponModalOpen(false);
    };

    async function handleMintCoupon(formData: CreateCoupon) {
        console.log("Minting coupon with data:", formData);

        try {
            const [mint, couponPda] = await queryClient.fetchQuery({
                queryKey: ["create_coupon"],
                queryFn: () => {
                    if (anchorClient === null)
                        throw new Error("anchorClient is null");
                    if (formData === null) throw new Error("formData is null");
                    return createCoupon(anchorClient, formData);
                },
            });
            console.log(`couponPda: ${couponPda} mint: ${mint}`);
        } catch (error) {
            console.log(error);
        }

        handleCloseMintCouponModal();
    }

    return (
        <main className="flex flex-grow items-center justify-center">
            <div className="text-center">
                <Image
                    src="/next.svg"
                    alt="Next.js Logo"
                    width={180}
                    height={37}
                    priority
                />
            </div>
            <div className="container mx-auto mt-8 text-center">
                <h1 className="text-4xl font-bold mb-8">
                    Welcome to the Christmas Protocol Marketplace
                </h1>
                <button
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
                    onClick={handleOpenMintCouponModal}
                >
                    Mint Coupon
                </button>
                {isMintCouponModalOpen && (
                    <MintCouponModal
                        onClose={handleCloseMintCouponModal}
                        onMintCoupon={handleMintCoupon}
                    />
                )}
            </div>
        </main>
    );
}
