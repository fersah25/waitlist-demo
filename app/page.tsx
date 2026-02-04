import { Metadata } from "next";
import Dashboard from "./components/Dashboard";
import { minikitConfig } from "@/minikit.config";

export const metadata: Metadata = {
  title: "Onchain Trust Dashboard",
  description: "Check your Onchain Trust Score based on your Base wallet activity.",
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: minikitConfig.miniapp.heroImageUrl,
      button: {
        title: "Check Trust Score",
        action: {
          type: "launch_frame",
          name: minikitConfig.miniapp.name,
          url: minikitConfig.miniapp.homeUrl,
          splashImageUrl: minikitConfig.miniapp.splashImageUrl,
          splashBackgroundColor: minikitConfig.miniapp.splashBackgroundColor,
        },
      },
    }),
  },
};

export default function Page() {
  return <Dashboard />;
}