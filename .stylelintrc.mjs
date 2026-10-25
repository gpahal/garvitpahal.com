import { defineConfig } from '@gpahal/stylelint-config'

export default defineConfig({
  root: import.meta.dirname,
  tailwindcss: { entryPoint: 'src/styles/global.css' },
})
