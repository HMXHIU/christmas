import React, { useState, ChangeEvent, FormEvent } from "react";
import { MintCoupon } from "../../queries/queries";
import { Coupon } from "@/types";

interface MintCouponModalProps {
    coupon: Coupon;
    onClose: () => void;
    onMint: (formData: MintCoupon) => void;
}

const MintCouponModal: React.FC<MintCouponModalProps> = ({
    coupon,
    onClose,
    onMint,
}) => {
    const [formData, setFormData] = useState({
        numTokens: 1,
    });

    const handleChange = (
        e:
            | ChangeEvent<HTMLInputElement>
            | ChangeEvent<HTMLSelectElement>
            | ChangeEvent<HTMLTextAreaElement>
    ) => {
        const { name, value } = e.target;
        setFormData((prevData) => ({ ...prevData, [name]: value }));
    };

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onMint({
            mint: coupon.account.mint,
            region: coupon.account.region,
            numTokens: formData.numTokens,
        });
    };

    return (
        <div className="modal fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center">
            <div className="modal-content bg-white p-4 rounded-lg w-full max-w-lg relative">
                <button
                    className="close-button absolute top-4 right-4"
                    onClick={onClose}
                >
                    Close
                </button>
                <h2 className="text-xl font-bold mb-4">Mint Coupon</h2>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4 flex">
                        <label
                            htmlFor="name"
                            className="w-20 pr-2 flex-shrink-0"
                        >
                            Name:
                        </label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            maxLength={36}
                            readOnly={true}
                            value={coupon.account.name}
                            onChange={handleChange}
                            required
                            className="border rounded p-1 flex-1"
                        />
                    </div>
                    <div className="mb-4 flex">
                        <label
                            htmlFor="numTokens"
                            className="w-20 pr-2 flex-shrink-0"
                        >
                            Number of Coupons:
                        </label>
                        <input
                            type="number"
                            id="numTokens"
                            name="numTokens"
                            min={1}
                            value={formData.numTokens}
                            onChange={handleChange}
                            className="border rounded p-1 flex-1"
                        />
                    </div>
                    <div className="text-right">
                        <button
                            type="submit"
                            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
                        >
                            Mint Coupon
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default MintCouponModal;
