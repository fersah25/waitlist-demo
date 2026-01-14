"use client";
import { useEffect } from "react";
// Importu bu şekilde değiştiriyoruz (en garantisi budur)
import * as OnchainKitMinikit from "@coinbase/onchainkit/minikit";
import styles from "../page.module.css";

export default function Success() {    
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        // Kütüphaneyi 'any' olarak yakalayıp içindeki MiniKit'e ulaşıyoruz
        const minikit = (OnchainKitMinikit as any).MiniKit || OnchainKitMinikit;
        if (minikit && minikit.install) {
          minikit.install();
        }
      } catch (e) {
        console.error("MiniKit install hatası:", e);
      }
    }
  }, []);

  const handleShare = async () => {
    if (typeof window !== "undefined") {
      try {
        // MiniKit objesini her türlü ihtimale karşı buluyoruz
        const minikit = (OnchainKitMinikit as any).MiniKit || OnchainKitMinikit;
        
        if (minikit?.commands?.composeCast) {
          await minikit.commands.composeCast({
            text: "I just joined the CUBEY waitlist! 🚀",
            embeds: ["https://new-mini-app-quickstart-omega-nine.vercel.app/"]
          });
        } else {
          // Eğer hala bulamazsa manuel tetikleme deniyoruz
          alert("Lütfen Warpcast içinden açın!");
        }
      } catch (error) {
        console.error("Paylaşım hatası:", error);
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>Welcome to CUBEY!</h1>
        <p className={styles.subtitle}>
          You&apos;re in! Get ready for the future of marketing.
        </p>
        
        <button 
          type="button"
          onClick={handleShare} 
          className={styles.joinButton}
          style={{ 
            marginTop: '20px',
            backgroundColor: '#0052FF',
            padding: '15px 30px',
            borderRadius: '12px',
            color: 'white',
            fontWeight: 'bold',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          SHARE ON WARPCAST
        </button>
      </div>
    </div>
  );
}