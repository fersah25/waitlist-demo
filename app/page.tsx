import { Metadata } from "next";
import BaseRunner from "./components/BaseRunner"; // BaseShield yerine BaseRunner'ı çağırıyoruz

const appUrl = process.env.NEXT_PUBLIC_URL || "https://senin-yeni-urlin.vercel.app";

export const metadata: Metadata = {
  title: "Base Runner Game",
  description: "Jump and collect Base logos!",
  openGraph: {
    title: "Base Runner",
    description: "The ultimate Base Network runner game",
    images: [`${appUrl}/game-og-image.jpg`],
  },
  other: {
    "fc:frame": "vNext",
    "fc:frame:image": `${appUrl}/game-image.jpg`,
    "fc:frame:button:1": "Play Base Runner",
  },
};

export default function Page() {
  // Burası artık güvenlik tarayıcısını değil, oyunu açacak
  return <BaseRunner />;
}