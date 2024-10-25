import { component, defineMarkdocConfig, nodes } from '@astrojs/markdoc/config'
import shiki from '@astrojs/markdoc/shiki'

export default defineMarkdocConfig({
  nodes: {
    heading: {
      ...nodes.heading,
      render: component('./src/components/heading/index.astro'),
    },
  },
  extends: [
    shiki({
      theme: 'github-dark',
      wrap: true,
      langs: [],
    }),
  ],
})
