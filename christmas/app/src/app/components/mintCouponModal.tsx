import React, { useState, ChangeEvent, FormEvent } from "react";
import { CreateCoupon } from "../queries/queries";

interface MintCouponModalProps {
    onClose: () => void;
    onMintCoupon: (formData: CreateCoupon) => void;
}

const MintCouponModal: React.FC<MintCouponModalProps> = ({
    onClose,
    onMintCoupon,
}) => {
    const [formData, setFormData] = useState({
        name: "",
        symbol: "",
        description: "",
        numTokens: 1,
        region: "SGP",
        geo: "",
        image: "",
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

    const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData((prevData) => ({
                    ...prevData,
                    image: reader.result as string,
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onMintCoupon(formData);
    };

    return (
        <div className="modal fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center">
            <div className="modal-content bg-white p-4 rounded-lg w-full max-w-lg">
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
                            value={formData.name}
                            onChange={handleChange}
                            required
                            className="border rounded p-1 flex-1"
                        />
                    </div>
                    <div className="mb-4 flex">
                        <label
                            htmlFor="symbol"
                            className="w-20 pr-2 flex-shrink-0"
                        >
                            Symbol:
                        </label>
                        <input
                            type="text"
                            id="symbol"
                            name="symbol"
                            maxLength={14}
                            value={formData.symbol}
                            onChange={handleChange}
                            required
                            className="border rounded p-1 flex-1"
                        />
                    </div>
                    <div className="mb-4 flex">
                        <label
                            htmlFor="description"
                            className="w-20 pr-2 flex-shrink-0"
                        >
                            Description:
                        </label>
                        <textarea
                            id="description"
                            name="description"
                            maxLength={2048}
                            value={formData.description}
                            onChange={handleChange}
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
                    <div className="mb-4 flex">
                        <label
                            htmlFor="region"
                            className="w-20 pr-2 flex-shrink-0"
                        >
                            Region:
                        </label>
                        <select
                            id="region"
                            name="region"
                            value={formData.region}
                            onChange={handleChange}
                            required
                            className="border rounded p-1 flex-1"
                        >
                            <option value="SGP">SGP</option>
                            {/* Add more options for other regions if needed */}
                        </select>
                    </div>
                    <div className="mb-4 flex">
                        <label
                            htmlFor="geo"
                            className="w-20 pr-2 flex-shrink-0"
                        >
                            Location:
                        </label>
                        <input
                            type="text"
                            id="geo"
                            name="geo"
                            value={formData.geo}
                            onChange={handleChange}
                            className="border rounded p-1 flex-1"
                        />
                    </div>
                    <div className="mb-4 flex">
                        <label
                            htmlFor="image"
                            className="w-20 pr-2 flex-shrink-0"
                        >
                            Image:
                        </label>
                        <input
                            type="file"
                            id="image"
                            name="image"
                            onChange={handleImageUpload}
                            className="border rounded p-1 flex-1"
                        />
                        {formData.image && (
                            <img
                                src={formData.image}
                                alt="Preview"
                                className="mt-2 w-24 h-24"
                            />
                        )}
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
