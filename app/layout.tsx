import type { Metadata } from "next";

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
    openGraph: {
      title: "Cubey",
      description: "Your AI Ad Companion",
      images: [`${appUrl}/blue-icon.png`],
      url: appUrl,
    },
    other: {
      "fc:miniapp": JSON.stringify(miniappConfig),
    },
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}