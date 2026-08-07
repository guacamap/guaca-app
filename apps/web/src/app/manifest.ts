import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GUACA Spotter',
    short_name: 'GUACA',
    description: 'Misiones de verificación local en Puerto Cabello',
    start_url: '/spotter',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1d5cb0',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
