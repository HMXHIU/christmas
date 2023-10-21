import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { CreateCoupon } from "../../queries/queries";
import { COUNTRY_DETAILS } from "../../../lib/constants";

import { useClientDevice } from "@/providers/ClientDeviceProvider";

interface CreateCouponModalProps {
    onClose: () => void;
    onCreateCoupon: (formData: CreateCoupon) => void;
}

const CreateCouponModal: React.FC<CreateCouponModalProps> = ({
    onClose,
    onCreateCoupon,
}) => {
    const clientDevice = useClientDevice();

    const [formData, setFormData] = useState<CreateCoupon>({
        name: "",
        symbol: "",
        description: "",
        region: clientDevice?.country?.code || "",
        geo: "",
        image: null,
        uri: "",
    });

    const [image, setImage] = useState<string | null>(null);

    useEffect(() => {
        if (clientDevice) {
            setFormData((prevData) => ({
                ...prevData,
                geo: clientDevice.geohash || "",
            }));
        }
    }, [clientDevice]);

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
            setFormData((prevData) => ({
                ...prevData,
                image: file,
            }));

            // file preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onCreateCoupon(formData);
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
                <h2 className="text-xl font-bold mb-4">Create Coupon</h2>
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
                            {Object.values(COUNTRY_DETAILS).map(
                                ([code, name]) => (
                                    <option value={code} id={code} key={code}>
                                        {name}
                                    </option>
                                )
                            )}
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
                        {image && (
                            <img
                                src={image}
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
                            Create Coupon
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateCouponModal;
