import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Íconos de la PWA a partir del logo de la parroquia (fondo blanco: el logo es
// transparente y en Android/iOS quedaría sobre negro).
// Regenerar con: npm run generate-pwa-assets
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: { ...minimal2023Preset.transparent, favicons: [] },
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#ffffff' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#ffffff' } },
  },
  images: ['public/pwa-source.png'],
})
