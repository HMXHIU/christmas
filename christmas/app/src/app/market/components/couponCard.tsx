import React from "react";
import { Coupon } from "@/types";

interface CouponCardProps {
    coupon: Coupon;
    supply?: number;
    balance?: number;
    onClick: () => void;
}

const CouponCard: React.FC<CouponCardProps> = ({
    coupon,
    supply,
    balance,
    onClick,
}) => {
    return (
        <div className="border p-4 my-2 cursor-pointer" onClick={onClick}>
            <img
                src=""
                alt="Coupon"
                className="w-24 h-24 object-cover rounded-md"
            />
            <p className="mt-2">name: {coupon.account.name}</p>
            <p className="mt-2">symbol: {coupon.account.symbol}</p>
            <p className="mt-2">region: {coupon.account.region}</p>
            <p className="mt-2">geo: {coupon.account.geo}</p>
            {supply !== undefined ? (
                <p className="mt-2">supply: {supply}</p>
            ) : null}
            {balance !== undefined ? (
                <p className="mt-2">balance: {balance}</p>
            ) : null}
        </div>
    );
};

export default CouponCard;
