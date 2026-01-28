const ROOT_URL =
  process.env.NEXT_PUBLIC_URL ||
  (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
  "http://localhost:3000";

/**
 * MiniApp configuration object. Must follow the mini app manifest specification.
 *
 * @see {@link https://docs.base.org/mini-apps/features/manifest}
 */
export const minikitConfig = {
  accountAssociation: {
    header: "eyJmaWQiOjE0NTEyMjgsInR5cGUiOiJhdXRoIiwia2V5IjoiMHhlZjVGRGVmNzg3QzJBMkFGRmRmNDgwMjU0Y2Y2MTQ3ZDNCZDBCQ0M2In0",
    payload: "eyJkb21haW4iOiJmZXJzYWgtYXBwLnZlcmNlbC5hcHAifQ",
    signature: "k9jAvrUELf2lRt/kYuBgUJckfLuE11nV0GfvK9z1z+Br1YUSQV8iLVKyFLZvXN4Z59tUBl3UB8ta6hmZeI8xxRs=",
  },
  baseBuilder: {
    ownerAddress: "",
  },
  miniapp: {
    version: "1",
    name: "fersahapp",
    subtitle: "AI powered ad companion",
    description: "fersahapp is the ultimate AI powered ad companion for the Farcaster ecosystem built on Base",
    screenshotUrls: [`${ROOT_URL}/blue-icon.png`],
    iconUrl: `${ROOT_URL}/blue-icon.png`,
    splashImageUrl: `${ROOT_URL}/blue-icon.png`,
    splashBackgroundColor: "#000000",
    homeUrl: ROOT_URL,
    webhookUrl: `${ROOT_URL}/api/webhook`,
    primaryCategory: "social",
    tags: ["social", "ai", "ads"],
    heroImageUrl: `${ROOT_URL}/blue-icon.png`,
    tagline: "AI powered ad companion",
    ogTitle: "fersahapp",
    ogDescription: "fersahapp is the ultimate AI powered ad companion for the Farcaster ecosystem built on Base",
    ogImageUrl: `${ROOT_URL}/blue-icon.png`,
  },
} as const; 