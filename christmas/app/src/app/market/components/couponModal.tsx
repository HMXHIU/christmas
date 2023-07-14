import React from "react";

interface CouponModalProps {
    coupon: Coupon;
    onClose: () => void;
    onRedeem: () => void;
}

interface Coupon {
    id: string;
    image: string;
    description: string;
    detailedDescription: string;
}

const CouponModal: React.FC<CouponModalProps> = ({
    coupon,
    onClose,
    onRedeem,
}) => {
    return (
        <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center bg-black bg-opacity-50">
            <div className="bg-white p-8 rounded-lg max-w-md">
                <img
                    src={coupon.image}
                    alt="Coupon"
                    className="w-40 h-40 object-cover rounded-md mx-auto"
                />
                <p className="text-center mt-4">{coupon.detailedDescription}</p>
                <div className="flex justify-center mt-6">
                    <button
                        className="px-4 py-2 bg-green-500 text-white rounded-md mr-2"
                        onClick={onRedeem}
                    >
                        Redeem
                    </button>
                    <button
                        className="px-4 py-2 bg-gray-500 text-white rounded-md"
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CouponModal;
