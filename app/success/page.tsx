"use client";
import { useEffect } from "react";
import { useMiniKit, useComposeCast } from '@coinbase/onchainkit/minikit';
import styles from "../page.module.css";

export default function Success() {
  const { isFrameReady, setFrameReady } = useMiniKit();
  const { composeCastAsync } = useComposeCast();
  
  // MiniKit'in hazır olduğundan emin oluyoruz
  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [isFrameReady, setFrameReady]);

  const handleShare = async () => {
    try {
      console.log("Share butonuna basıldı...");
      await composeCastAsync({
        text: "I just joined the CUBEY waitlist! 🚀",
        embeds: ["https://new-mini-app-quickstart-omega-nine.vercel.app/"]
      });
    } catch (error) {
      console.error("Paylaşım hatası:", error); 
    }
  };

  return (
    <div className={styles.container} style={{ cursor: 'pointer' }}>
      <div className={styles.content}>
        <h1 className={styles.title}>Welcome to CUBEY!</h1>
        <p className={styles.subtitle}>You&apos;re in! Get ready for the future of marketing.</p>
        
        {/* Butonu daha belirgin ve en üstte yapıyoruz */}
        <button 
          onClick={handleShare} 
          className={styles.joinButton}
          style={{ 
            position: 'relative', 
            zIndex: 999, 
            marginTop: '20px',
            backgroundColor: '#0052FF', // Garanti olsun diye renk çaktık
            padding: '15px 30px',
            borderRadius: '12px',
            color: 'white',
            fontWeight: 'bold'
          }}
        >
          SHARE ON WARPCAST
        </button>
      </div>
    </div>
  );
}