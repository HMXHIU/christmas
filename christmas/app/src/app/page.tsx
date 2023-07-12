"use client";

import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";
import { useWallet } from "@solana/wallet-adapter-react";

export default function Home() {
    const { connected } = useWallet();

    return (
        <div className={styles.container}>
            <nav className={styles.navbar}>
                <div className={styles.login}>
                    {connected ? (
                        <button className={styles.button}>Logout</button>
                    ) : (
                        <button className={styles.button}>Login</button>
                    )}
                </div>
            </nav>

            <main className={styles.main}>
                <div className={styles.center}>
                    <Image
                        className={styles.logo}
                        src="/next.svg"
                        alt="Next.js Logo"
                        width={180}
                        height={37}
                        priority
                    />
                </div>
            </main>

            <nav className={styles.bottomNavbar}>
                <Link href="/marketplace" legacyBehavior>
                    <a className={styles.navLink}>
                        <img
                            src="/marketplace-icon.svg"
                            alt="Marketplace"
                            className={styles.navIcon}
                        />
                        <span>Marketplace</span>
                    </a>
                </Link>
                <Link href="/my-coupons" legacyBehavior>
                    <a className={styles.navLink}>
                        <img
                            src="/my-coupons-icon.svg"
                            alt="My Coupons"
                            className={styles.navIcon}
                        />
                        <span>My Coupons</span>
                    </a>
                </Link>
                <Link href="/mint-coupons" legacyBehavior>
                    <a className={styles.navLink}>
                        <img
                            src="/mint-coupons-icon.svg"
                            alt="Mint Coupons"
                            className={styles.navIcon}
                        />
                        <span>Mint Coupons</span>
                    </a>
                </Link>
            </nav>
        </div>
    );
}
