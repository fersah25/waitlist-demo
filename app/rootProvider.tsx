"use client";

import { ReactNode, useEffect, useState } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { base } from "viem/chains";

export function RootProvider({ children }: { children: ReactNode }) {
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

  if (!isSDKReady) {
    return null;
  }

  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAIN_KIT_API_KEY || ""}
      chain={base}
      config={
        {
          // @ts-expect-error MiniKit is not explicitly typed in current OnchainKit version
          appearance: { name: "Waitlist Demo", miniKit: true }
        }
      }
    >
      {children}
    </OnchainKitProvider>
  );
}