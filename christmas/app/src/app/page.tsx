"use client";

import { useState } from "react";
import Image from "next/image";
import MintCouponModal from "./components/mintCouponModal";

export default function Home() {
    const [isMintCouponModalOpen, setIsMintCouponModalOpen] = useState(false);

    const handleOpenMintCouponModal = () => {
        setIsMintCouponModalOpen(true);
    };

    const handleCloseMintCouponModal = () => {
        setIsMintCouponModalOpen(false);
    };

    const handleMintCoupon = (formData: any) => {
        // Here, you can send the formData to the backend or perform any other action.
        console.log("Minting coupon with data:", formData);
        handleCloseMintCouponModal();
    };

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
