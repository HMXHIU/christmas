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

    const copyToClipboard = () => {
        if (qrCodeURL) {
            navigator.clipboard.writeText(qrCodeURL).then(() => {
                // Clipboard copy success
                alert("QR Code URL copied to clipboard!");
            });
        }
    };

    return (
        <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center bg-black bg-opacity-50">
            <div className="bg-white p-8 rounded-lg max-w-md relative">
                <button
                    className="close-button absolute top-4 right-4"
                    onClick={onClose}
                >
                    Close
                </button>

                <p className="text-center mt-4">{coupon.account.name}</p>

                {qrCodeURL && <canvas ref={qrCanvasRef} />}

                {qrCodeURL && (
                    <div>
                        <input
                            type="text"
                            value={qrCodeURL}
                            readOnly
                            className="border border-gray-300 rounded p-1 w-full flex-1"
                        />
                        <button
                            className="clipboard-button px-4 py-2 bg-blue-500 text-white rounded-md ml-2"
                            onClick={copyToClipboard}
                        >
                            <svg
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                className="w-5 h-5 inline-block mr-2 -mt-0.5"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M9 5l7 7-7 7"
                                />
                            </svg>
                            Copy to Clipboard
                        </button>
                    </div>
                )}

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
