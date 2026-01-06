import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cubey Waitlist',
    short_name: 'Cubey',
    description: 'Join the Cubey Waitlist on Base',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0052ff',
    icons: [{ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }],
    // @ts-expect-error - Base field
    accountAssociation: {
      header: "eyJmaWQiOjE0NTEyMjgsInR5cGUiOiJjdXN0b2R5Iiwia2V5IjoiMHgwZjlFMjNBNzJmMTNjYzNkZUUxNzUxODFGMTY1OWIxNjI4RjlFNjE2In0",
      payload: "eyJkb21haW4iOiJuZXctbWluaS1hcHAtcXVpY2tzdGFydC1vbWVnYS1uaW5lLnZlcmNlbC5hcHAifQ",
      signature: "o21xykGx3xe8Yf4KdFcfeey9FvZn6tQtCrQ5YZeE9QoJTft84WBjSK62L8udaPHUe9tq+d5m8RlBSRniYl/FQxs="
    }
  };
}
