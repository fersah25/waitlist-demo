import { Metadata } from "next";
import BaseRunner from "./components/BaseRunner";

const appUrl = process.env.NEXT_PUBLIC_URL || "https://waitlist-demo-neon.vercel.app";

export const metadata: Metadata = {
  title: "Base Surfer",
  description: "Surf the Infinite Base Grid!",
  openGraph: {
    title: "Base Surfer",
    description: "Surf the Infinite Base Grid!",
    images: [`${appUrl}/park-1.jpg`],
  },
  other: {
    "fc:frame": "vNext",
    "fc:frame:image": `${appUrl}/park-1.jpg`,
    "fc:frame:button:1": "Play Base Surfer",
    "fc:frame:action": "link",
    "fc:frame:target": appUrl,
  },
};

export default function Page() {
  return <BaseRunner />;
}