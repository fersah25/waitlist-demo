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
    header: "eyJmaWQiOjE0NTEyMjgsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHgwZjlFMjNBNzJmMTNjYzNkZUUxNzUxODFGMTY1OWIxNjI4RjlFNjE2In0",
    payload: "eyJkb21haW4iOiJ3YWl0bGlzdC1kZW1vLW5lb24udmVyY2VsLmFwcCJ9",
    signature: "2heX9rqYL2aPXPaSA6Le31E3PDfRua4dqs2VGXfR6jg38b1eoe8l0rPXD3Ty0bYuUdIhc9t74beezjDejoccaBs=",
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