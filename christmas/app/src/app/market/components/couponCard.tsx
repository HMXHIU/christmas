import React from "react";
import { Coupon } from "@/types";

interface CouponCardProps {
    coupon: Coupon;
    onClick: () => void;
}

const CouponCard: React.FC<CouponCardProps> = ({ coupon, onClick }) => {
    return (
        <div className="border p-4 my-2 cursor-pointer" onClick={onClick}>
            <img
                src=""
                alt="Coupon"
                className="w-24 h-24 object-cover rounded-md"
            />
            <p className="mt-2">{coupon.account.name}</p>
        </div>
    );
};

export default CouponCard;
