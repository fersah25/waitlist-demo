const ROOT_URL =
  process.env.NEXT_PUBLIC_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');

/**
 * MiniApp configuration object. Must follow the Farcaster MiniApp specification.
 *
 * @see {@link https://miniapps.farcaster.xyz/docs/guides/publishing}
 */
export const minikitConfig = {
  accountAssociation: {
    header: "eyJmaWQiOjE0NTEyMjgsInR5cGUiOiJhdXRoIiwia2V5IjoiMHhlZjVGRGVmNzg3QzJBMkFGRmRmNDgwMjU0Y2Y2MTQ3ZDNCZDBCQ0M2In0",
    payload: "eyJkb21haW4iOiJuZXctbWluaS1hcHAtcXVpY2tzdGFydC1vbWVnYS1uaW5lLnZlcmNlbC5hcHAifQ",
    signature: "o21xykGx3xe8Yf4KdFcfeey9FvZn6tQtCrQ5YZeE9QoJTft84WBjSK62L8udaPHUe9tq+d5m8RlBSRniYl/FQxs="
  },
  miniapp: {
    version: "1",
    name: "fersahapp", 
    subtitle: "Your AI Ad Companion", 
    description: "Ads",
    screenshotUrls: [`${ROOT_URL}/screenshot-portrait.png`],
    iconUrl: `${ROOT_URL}/blue-icon.png`,
    splashImageUrl: `${ROOT_URL}/blue-hero.png`,
    splashBackgroundColor: "#000000",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "social",
    tags: ["marketing", "ads", "quickstart", "waitlist"],
    heroImageUrl: `${ROOT_URL}/blue-hero.png`, 
    tagline: "",
    ogTitle: "",
    ogDescription: "",
    ogImageUrl: `${ROOT_URL}/blue-hero.png`,
  },
} as const;

