"use client";
import styles from "../page.module.css";

export default function Success() {   
  
  const handleShare = () => {
    // Warpcast paylaşım ekranını tetikleyen ham protokol komutu
    const shareCommand = {
      type: "compose-cast", 
      data: {
        text: "I just joined the CUBEY waitlist! 🚀",
        embeds: ["https://new-mini-app-quickstart-omega-nine.vercel.app/"]
      }
    };

    if (typeof window !== "undefined") {
      // Warpcast uygulamasına direkt mesaj gönderiyoruz
      window.parent.postMessage(shareCommand, "*");
      console.log("Paylaşım komutu gönderildi");
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