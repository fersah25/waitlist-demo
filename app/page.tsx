"use client";
import { useState, useEffect } from "react";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownDisconnect } from "@coinbase/onchainkit/wallet";
import { Address, Avatar, Name, Identity, EthBalance } from "@coinbase/onchainkit/identity";
import styles from "./page.module.css";

export default function Home() {
  const { isFrameReady, setFrameReady, context } = useMiniKit();
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [isFrameReady, setFrameReady]);

  const handleScoreClick = () => {
    setScore(score + 1);
  };

  return (
    <div className={styles.container}>
      <header className="w-full flex justify-between items-center p-4 absolute top-0 left-0 z-10">
        <div className="font-bold text-xl text-white">fersahapp</div>
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
          <h1 className={styles.title}>Fersah Clicker</h1>
          <p className={styles.subtitle}>Welcome, {context?.user?.displayName || "Player"}!</p>
          
          <div className={styles.scoreDisplay}>
            <p className="text-sm uppercase tracking-widest opacity-70">Total Clicks</p>
            <h2 className={styles.scoreNumber}>{score}</h2>
          </div>

          <button onClick={handleScoreClick} className={styles.joinButton}>
            🖱️ CLICK ME!
          </button>
          
          <p className="mt-6 text-xs opacity-50 uppercase tracking-widest">
            Tap to dominate the Base network
          </p>
        </div>
      </div>
    </div>
  );
}