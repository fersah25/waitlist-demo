"use client";

import { ReactNode, useEffect, useState } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { OnchainKitProvider } from "@coinbase/onchainkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { base } from "viem/chains";
import { http, createConfig } from 'wagmi';
import { farcasterMiniApp } from '@farcaster/miniapp-wagmi-connector';


const queryClient = new QueryClient();

const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  connectors: [farcasterMiniApp()],
});

export default function Providers({ children }: { children: ReactNode }) {
  const [isSDKReady, setIsSDKReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await sdk.actions.ready();
      } catch (error) {
        console.error("Farcaster SDK error (might be normal browser):", error);
      } finally {
        setIsSDKReady(true);
      }
    };

    if (!isSDKReady) {
      init();
    }
  }, [isSDKReady]);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_ONCHAIN_KIT_API_KEY || "public"}
          chain={base}
          config={{ appearance: { name: "Waitlist Demo" } }}
          miniKit={{ enabled: true }}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}