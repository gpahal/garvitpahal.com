import { defineConfig } from 'astro/config'

import markdoc from '@astrojs/markdoc'
import sitemap from '@astrojs/sitemap'

/** @type {import("astro").AstroUserConfig} */
export default defineConfig({
  site: 'https://garvitpahal.com',
  integrations: [sitemap(), markdoc()],
})
