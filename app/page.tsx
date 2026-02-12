import { Metadata } from "next";
import BaseShield from "./components/BaseShield";

const appUrl = process.env.NEXT_PUBLIC_URL || "https://waitlist-demo-neon.vercel.app";

export const metadata: Metadata = {
  title: "Base Shield",
  description: "Security Checker for Base Network Tokens",
  openGraph: {
    title: "Base Shield",
    description: "Check token security on Base Network",
    images: [`${appUrl}/park-1.jpg`], // Keeping image for now or use default
  },
  other: {
    "fc:frame": "vNext",
    "fc:frame:image": `${appUrl}/park-1.jpg`,
    "fc:frame:button:1": "Check Token Security",
    "fc:frame:action": "link",
    "fc:frame:target": appUrl,
  },
};

export default function Page() {
  return <BaseShield />;
}