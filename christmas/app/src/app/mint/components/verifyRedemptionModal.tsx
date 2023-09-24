// components/VerifyRedemptionModal.tsx
import React, { useState, useCallback } from "react";
import { QrReader, OnResultFunction } from "react-qr-reader";

interface VerifyRedemptionModalProps {
    onClose: () => void;
    onQRCodeScan: (qrCodeValue: string) => void;
    verificationStatus?: string | null;
}

const VerifyRedemptionModal: React.FC<VerifyRedemptionModalProps> = ({
    onClose,
    onQRCodeScan,
    verificationStatus,
}) => {
    const [qrCodeValue, setQRCodeValue] = useState<string | null>(null);

    const handleScan = useCallback<OnResultFunction>(
        (result, _) => {
            if (result) {
                const text = result.getText();
                setQRCodeValue(text);
                onQRCodeScan(text);
            }
        },
        [onQRCodeScan]
    );

    const handlePasteFromClipboard = () => {
        navigator.clipboard.readText().then((text) => {
            setQRCodeValue(text);
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
                <h2 className="text-xl font-bold mb-4">Verify Redemption</h2>
                <QrReader
                    onResult={handleScan}
                    containerStyle={{ width: "100%" }}
                    constraints={{ facingMode: "user" }}
                />
                <div className="mt-4 flex">
                    <input
                        type="text"
                        value={qrCodeValue || ""}
                        readOnly
                        className="border rounded p-1 flex-1"
                    />
                    <button
                        onClick={handlePasteFromClipboard}
                        className="bg-blue-500 text-white px-4 py-2 rounded ml-2"
                    >
                        Paste
                    </button>
                </div>
                <div className="mt-4">
                    <input
                        type="text"
                        value={verificationStatus || ""}
                        readOnly
                        className="border border-gray-300 rounded p-1 w-full"
                    />
                </div>
            </div>
        </div>
    );
};

export default VerifyRedemptionModal;
