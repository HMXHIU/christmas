"use client";

import Image from "next/image";

export default function Home() {
    return (
        <main className="flex flex-grow items-center justify-center">
            <div className="text-center">
                <Image
                    src="/next.svg"
                    alt="Next.js Logo"
                    width={180}
                    height={37}
                    priority
                />
            </div>
        </main>
    );
}
