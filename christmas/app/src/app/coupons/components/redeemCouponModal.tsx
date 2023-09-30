import React, { useRef, useEffect } from "react";
import { Coupon } from "@/types";
import QRCode from "qrcode";

interface RedeemCouponModalProps {
    coupon: Coupon;
    qrCodeURL: string | null;
    onClose: () => void;
    onRedeem: (coupon: Coupon) => void;
}

const RedeemCouponModal: React.FC<RedeemCouponModalProps> = ({
    coupon,
    qrCodeURL,
    onClose,
    onRedeem,
}) => {
    const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        if (qrCanvasRef.current && qrCodeURL) {
            QRCode.toCanvas(qrCanvasRef.current, qrCodeURL, function (error) {
                if (error) console.error(error);
            });
        }
    }, [qrCodeURL]);

    return (
        <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center bg-black bg-opacity-50">
            <div className="bg-white p-8 rounded-lg max-w-md relative">
                <button
                    className="close-button absolute top-4 right-4"
                    onClick={onClose}
                >
                    Close
                </button>

                {qrCodeURL ? (
                    <canvas ref={qrCanvasRef} />
                ) : (
                    <img
                        src=""
                        alt="Coupon"
                        className="w-40 h-40 object-cover rounded-md mx-auto"
                    />
                )}

                <p className="text-center mt-4">{coupon.account.name}</p>

                {qrCodeURL ? null : (
                    <div className="flex justify-center mt-6">
                        <button
                            className="px-4 py-2 bg-green-500 text-white rounded-md mr-2"
                            onClick={() => onRedeem(coupon)}
                        >
                            Redeem Coupon
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default RedeemCouponModal;
