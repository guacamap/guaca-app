import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GUACA Spotter',
    short_name: 'GUACA',
    description: 'Misiones de verificación local en Puerto Cabello',
    start_url: '/spotter',
    display: 'standalone',
    background_color: '#f7f6f2',
    theme_color: '#0b0b0b',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
