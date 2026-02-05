import { Metadata } from "next";
import BaseNinja from "./components/BaseNinja";

const appUrl = process.env.NEXT_PUBLIC_URL || "https://waitlist-demo-neon.vercel.app";

export const metadata: Metadata = {
  title: "Base Ninja",
  description: "Slice the Base Orbs!",
  openGraph: {
    title: "Base Ninja",
    description: "Slice the Base Orbs!",
    images: [`${appUrl}/park-1.jpg`],
  },
  other: {
    "fc:frame": "vNext",
    "fc:frame:image": `${appUrl}/park-1.jpg`,
    "fc:frame:button:1": "Play Base Ninja",
    "fc:frame:action": "link",
    "fc:frame:target": appUrl,
  },
};

export default function Page() {
  return <BaseNinja />;
}