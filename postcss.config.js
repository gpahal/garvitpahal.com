module.exports = {
  plugins: {
    "postcss-import": {},
    tailwindcss: {},
    "tailwindcss/nesting": {},
    autoprefixer: {},
    "postcss-preset-env": {
      features: { "nesting-rules": false },
    },
    ...(process.env.NODE_ENV === "production" ? { cssnano: {} } : {}),
  },
};
