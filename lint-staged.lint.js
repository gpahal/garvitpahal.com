module.exports = {
  "**/*.{js,jsx,ts,tsx}": ["eslint"],
  "**/*.{ts,tsx}": ["tsc-files --noEmit"],
  "./styles/**/*.css": "stylelint",
};
