"use client";
import { useState, useEffect } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet";
import { Address, Avatar, Name, Identity, EthBalance } from "@coinbase/onchainkit/identity";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function Home() {
  const { isFrameReady, setFrameReady, context } = useMiniKit();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [isFrameReady, setFrameReady]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email");
      return;
    }
    router.push("/success");
  };

  return (
    <div className={styles.container}>
      <header className="w-full flex justify-between items-center p-4 absolute top-0 left-0 z-10">
        <div className="font-bold text-xl text-white">CUBEY</div>
        <Wallet>
          <ConnectWallet className="bg-[#0052FF]">
            <Avatar className="h-6 w-6" />
            <Name />
          </ConnectWallet>
          <WalletDropdown>
            <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
              <Avatar /><Name /><Address /><EthBalance />
            </Identity>
            <WalletDropdownDisconnect />
          </WalletDropdown>
        </Wallet>
      </header>

      <div className={styles.content}>
        <div className={styles.waitlistForm}>
          <h1 className={styles.title}>Join CUBEY</h1>
          <p className={styles.subtitle}>Hey {context?.user?.displayName || "there"}, get early access.</p>
          <form onSubmit={handleSubmit} className={styles.form}>
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.emailInput}
            />
            {error && <p className="text-red-500 mt-2">{error}</p>}
            <button type="submit" className={styles.joinButton}>JOIN WAITLIST</button>
          </form>
        </div>
      </div>
    </div>
  );
} 