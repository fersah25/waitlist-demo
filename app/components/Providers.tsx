"use client";

import { ReactNode, useEffect, useState } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { base } from "viem/chains";

export default function Providers({ children }: { children: ReactNode }) {
  const [isSDKReady, setIsSDKReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        // SDK'yı güvenli bir şekilde başlatıyoruz
        await sdk.actions.ready();
      } catch (error) {
        console.error("Farcaster SDK hatası (Normal tarayıcı olabilir):", error);
      } finally {
        setIsSDKReady(true);
      }
    };

    if (!isSDKReady) {
      init();
    }
  }, [isSDKReady]);

  // Removed "if (!isSDKReady) return null;" to ensure the app doesn't show a blank screen on non-Farcaster web browsers.

  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAIN_KIT_API_KEY || "public"}
      chain={base}
      config={
        {
          // @ts-expect-error some versions of OnchainKit don't type miniKit explicitly.
          appearance: { name: "Waitlist Demo", miniKit: true }
        }
      }
    >
      {children}
    </OnchainKitProvider>
  );
}