import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Hangout Planner',
    short_name: 'Hangout',
    description: 'A sleek workspace for your friend group.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f9f9f9',
    theme_color: '#0a0a0a',
    icons: [
      {
        src: '/path/to/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
    ],
  };
}