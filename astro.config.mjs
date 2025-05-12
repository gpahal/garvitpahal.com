import { defineConfig } from 'astro/config'

import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import expressiveCode from 'astro-expressive-code'

/** @type {import("astro").AstroUserConfig} */
export default defineConfig({
  site: 'https://garvitpahal.com',
  integrations: [sitemap(), expressiveCode(), mdx()],
})
