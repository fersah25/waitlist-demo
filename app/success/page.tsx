"use client";
import { useEffect } from "react";
import * as minikit_lib from "@coinbase/onchainkit/minikit";
import styles from "../page.module.css";

export default function Success() {   
  
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        // @ts-ignore
        const mk = minikit_lib.MiniKit || (minikit_lib as any).MiniKit;
        if (mk && typeof mk.install === 'function') {
          mk.install();
        }
      } catch (e) {
        console.error("MiniKit initialization error:", e);
      }
    }
  }, []);

  const handleShare = async () => {
    if (typeof window !== "undefined") {
      try {
        // @ts-ignore
        const mk = minikit_lib.MiniKit || (minikit_lib as any).MiniKit;
        
        if (mk?.commands?.composeCast) {
          await mk.commands.composeCast({
            text: "I just joined the CUBEY waitlist! 🚀",
            embeds: ["https://new-mini-app-quickstart-omega-nine.vercel.app/"]
          });
        } else {
          alert("Please open this in Warpcast!");
        }
      } catch (error) {
        console.error("Share error:", error);
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