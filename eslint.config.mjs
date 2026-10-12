import { globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import eslintConfigPrettier from 'eslint-config-prettier/flat';

const config = [
  ...nextVitals,
  ...nextTs,
  // Turn off stylistic ESLint rules that conflict with Prettier.
  eslintConfigPrettier,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
];

export default config;
