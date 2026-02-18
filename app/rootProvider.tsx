"use client";

import { ReactNode, useEffect } from "react";
import sdk from "@farcaster/frame-sdk";
import { base } from "viem/chains";
import { OnchainKitProvider } from "@coinbase/onchainkit";

export function RootProvider({ children }: { children: ReactNode }) {

  useEffect(() => {
    const init = async () => {
      try {
        await sdk.actions.ready();
      } catch (error) {
        console.error("Farcaster SDK error:", error);
      }
    };
    init();
  }, []);

  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAIN_KIT_API_KEY}
      chain={base}
      config={{
        // MiniKit hatasını bu blok çözecek
        paymaster: "",
      }}
    >
      {children}
    </OnchainKitProvider>
  );
}