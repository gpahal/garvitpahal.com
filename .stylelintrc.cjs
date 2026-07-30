/** @type {import("stylelint").Config} */
const config = {
  extends: ['@gpahal/stylelint-config/base'],
  rules: {
    // Tailwind's vite plugin only inlines string-notation imports; url() imports are left as-is
    'import-notation': 'string',
  },
}

module.exports = config
