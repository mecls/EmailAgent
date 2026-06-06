import type { MetadataRoute } from 'next'
import { SITE_CONFIG } from '@/lib/site-config'

/**
 * Web app manifest — makes EmailAgent installable as a standalone PWA. Served at
 * /manifest.webmanifest. Icons live in public/icons/ (provided separately); the
 * manifest validates without them, but install prompts want them present.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_CONFIG.brand,
    short_name: SITE_CONFIG.brand,
    description: SITE_CONFIG.description,
    start_url: '/app',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FAFAF7',
    theme_color: '#FAFAF7',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
