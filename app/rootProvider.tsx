"use client";

import { ReactNode, useEffect } from "react";
import sdk from "@farcaster/frame-sdk";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { base } from "viem/chains";

export function RootProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const init = async () => {
      // Sadece Farcaster içindeysek hazır olduğumuzu söyleyelim
      // Bu sayede normal tarayıcıda site çökmez
      if (typeof window !== "undefined") {
        try {
          await sdk.actions.ready();
        } catch (e) {
          console.error("Farcaster SDK not found, normal browser mode.");
        }
      }
    };
    init();
  }, []);

  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAIN_KIT_API_KEY}
      chain={base}
    >
      {children}
    </OnchainKitProvider>
  );
}