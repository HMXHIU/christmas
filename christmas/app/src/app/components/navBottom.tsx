import Link from "next/link";

export default () => {
    return (
        <nav className="bg-gray-900 text-white py-4 px-6 flex justify-between">
            <Link href="/market" legacyBehavior>
                <a className="flex flex-col items-center">
                    <img
                        src="/marketplace-icon.svg"
                        alt="Marketplace"
                        className="w-6 h-6 mb-1"
                    />
                    <span>Marketplace</span>
                </a>
            </Link>
            <Link href="/my-coupons" legacyBehavior>
                <a className="flex flex-col items-center">
                    <img
                        src="/my-coupons-icon.svg"
                        alt="My Coupons"
                        className="w-6 h-6 mb-1"
                    />
                    <span>My Coupons</span>
                </a>
            </Link>
            <Link href="/mint-coupons" legacyBehavior>
                <a className="flex flex-col items-center">
                    <img
                        src="/mint-coupons-icon.svg"
                        alt="Mint Coupons"
                        className="w-6 h-6 mb-1"
                    />
                    <span>Mint Coupons</span>
                </a>
            </Link>
        </nav>
    );
};
