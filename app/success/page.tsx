"use client";
import { useComposeCast } from '@coinbase/onchainkit/minikit';
import styles from "../page.module.css";

export default function Success() {
  const { composeCastAsync } = useComposeCast();
  
  const handleShare = async () => {
    try {
      await composeCastAsync({
        text: "I just joined the CUBEY waitlist! 🚀",
        embeds: ["https://new-mini-app-quickstart-omega-nine.vercel.app/"]
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Welcome to CUBEY!</h1>
        <p className={styles.subtitle}>You're in! Get ready for the future of marketing.</p>
        <button onClick={handleShare} className={styles.joinButton}>
          SHARE ON WARPCAST
        </button>
      </div>
    </div>
  );
}