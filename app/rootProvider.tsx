"use client";

import { ReactNode, useEffect } from "react";
import sdk from "@farcaster/frame-sdk";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { base } from "viem/chains";

export function RootProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const init = async () => {
      try {
        await sdk.actions.ready();
      } catch (e) {
        console.error(e);
      }
    };
    init();
  }, []);

  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAIN_KIT_API_KEY}
      chain={base}
      config={{
        appearance: { mode: "auto" }
      }}
    >
      {children}
    </OnchainKitProvider>
  );
}