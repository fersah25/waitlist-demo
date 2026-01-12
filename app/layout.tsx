import type { Metadata } from "next";
import { Inter, Source_Code_Pro } from "next/font/google";
import { RootProvider } from "./rootProvider";
import { SafeArea } from "@coinbase/onchainkit/minikit"; // Bu satırı ekledik
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
  return {
    title: "Cubey",
    description: "Your AI Ad Companion",
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: "https://new-mini-app-quickstart-omega-nine.vercel.app/blue-icon.png",
        button: {
          title: "Launch Cubey",
          action: {
            type: "launch_mini_app",
            name: "Cubey",
            url: "https://new-mini-app-quickstart-omega-nine.vercel.app",
            splashImageUrl: "https://new-mini-app-quickstart-omega-nine.vercel.app/blue-icon.png",
            splashBackgroundColor: "#000000",
          },
        },
      }),
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