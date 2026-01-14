"use client";
import { useState, useEffect } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet";
import { Address, Avatar, Name, Identity, EthBalance } from "@coinbase/onchainkit/identity";
import { useRouter } from "next/navigation";
import { minikitConfig } from "../minikit.config";
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
  }, [setFrameReady, isFrameReady]); 

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Please enter your email address");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    // Her şey okeyse direkt başarı sayfasına uçur
    router.push("/success");
  };

  return (
    <div className={styles.container}>
      <header className="w-full flex justify-between items-center p-4 absolute top-0 left-0">
        <div className="font-bold text-xl text-white">CUBEY</div>
        <Wallet>
          <ConnectWallet className="bg-[#0052FF] text-white rounded-full px-4 py-2 text-sm font-bold shadow-lg">
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
          <p className={styles.subtitle}>
             Hey {context?.user?.displayName || "there"}, Get early access and be the first to experience the future of marketing.
          </p>
          <form onSubmit={handleSubmit} className={styles.form}>
            <input
              type="email"
              placeholder="Your amazing email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.emailInput}
            />
            {error && <p className={styles.error} style={{color: 'red', marginTop: '10px'}}>{error}</p>}
            <button type="submit" className={styles.joinButton}>JOIN WAITLIST</button>
          </form>
        </div>
      </div>
    </div>
  );
}