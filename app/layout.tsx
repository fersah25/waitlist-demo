import type { Metadata } from "next";
import { Inter, Source_Code_Pro } from "next/font/google";
import { RootProvider } from "./rootProvider";
import { SafeArea } from "@coinbase/onchainkit/minikit";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const sourceCodePro = Source_Code_Pro({
  variable: "--font-source-code-pro",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const appUrl = "https://new-mini-app-quickstart-omega-nine.vercel.app";
  
  const miniappConfig = {
    version: "next",
    imageUrl: `${appUrl}/blue-icon.png`,
    button: {
      title: "Launch Cubey",
      action: {
        type: "launch_miniapp",
        name: "Cubey",
        url: appUrl,
        splashImageUrl: `${appUrl}/blue-icon.png`, 
        splashBackgroundColor: "#000000",
      },
    },
  };

  return {
    title: "Cubey",
    description: "Your AI Ad Companion",
    other: {
      "fc:miniapp": JSON.stringify(miniappConfig),
      // Frame uyumluluğu için ek yedek (bazı sürümler bunu arıyor)
      "fc:frame": "vNext",
      "fc:frame:image": `${appUrl}/blue-icon.png`,
      "fc:frame:button:1": "Launch Cubey",
      "fc:frame:button:1:action": "launch_miniapp",
      "fc:frame:button:1:target": appUrl,
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${sourceCodePro.variable}`}>
        <RootProvider>
          <SafeArea>{children}</SafeArea>
        </RootProvider>
      </body>
    </html>
  );
}