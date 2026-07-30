import { defineConfig } from 'astro/config'

import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import expressiveCode from 'astro-expressive-code'

export default defineConfig({
  site: 'https://garvitpahal.com',
  integrations: [sitemap(), expressiveCode(), mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
})
