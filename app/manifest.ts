import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CardMania',
    short_name: 'CardMania',
    description: 'Gérez votre collection de cartes à collectionner',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#2b4eff',
    theme_color: '#2b4eff',
    lang: 'fr',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
