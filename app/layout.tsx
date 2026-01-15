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
      title: "Launch fersahapp",
      action: {
        type: "launch_miniapp",
        name: "fersahapp",
        url: appUrl,
        splashImageUrl: `${appUrl}/blue-icon.png`, 
        splashBackgroundColor: "#000000",
      },
    },
  };

  return {
    title: "fersahapp",
    description: "Your AI Ad Companion",
    // OG kısmını buraya ekledim, listedeki kırmızıları bu yeşil yapacak:
    openGraph: {
      title: "fersahapp",
      description: "Your AI Ad Companion",
      images: [`${appUrl}/blue-icon.png`],
      url: appUrl,
    },
    other: {
      "fc:miniapp": JSON.stringify(miniappConfig),
      "fc:frame": "vNext",
      "fc:frame:image": `${appUrl}/blue-icon.png`,
      "fc:frame:button:1": "Launch fersahapp",
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
      <body className={`${inter.variable} ${sourceCodePro.variable} antialiased`}>
        <RootProvider>
          <SafeArea>{children}</SafeArea>
        </RootProvider>
      </body>
    </html>
  );
}