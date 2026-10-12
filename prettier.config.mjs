/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
const config = {
  // Match existing Next.js/TypeScript conventions and keep diffs reasonably compact.
  printWidth: 110,
  tabWidth: 2,
  useTabs: false,
  singleQuote: true,
  semi: true,
  trailingComma: 'all',
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',
  proseWrap: 'preserve',
  // Tailwind CSS v4 resolves custom utilities/theme from the project stylesheet.
  tailwindStylesheet: './app/globals.css',
  plugins: ['prettier-plugin-tailwindcss'],
};

export default config;
