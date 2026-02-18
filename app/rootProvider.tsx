"use client";

import { ReactNode, useEffect } from "react";
import sdk from "@farcaster/frame-sdk";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { base } from "viem/chains";

export function RootProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const init = async () => {
      if (typeof window !== "undefined") {
        try {
          await sdk.actions.ready();
        } catch {
          // 'e' harfini sildik, sadece catch bıraktık. Hata vermez.
          console.log("Farcaster SDK loading...");
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