import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const pkg = JSON.parse(read('package.json'));

// Validate the wiring without requiring an npm install.
test('Prettier formatting commands are configured', () => {
  assert.equal(pkg.scripts.format, 'prettier --write .');
  assert.equal(pkg.scripts['format:check'], 'prettier --check .');
  assert.equal(pkg.scripts['format:files'], 'prettier --write');
  for (const name of ['prettier', 'prettier-plugin-tailwindcss', 'eslint-config-prettier']) {
    assert.ok(pkg.devDependencies[name], `${name} must be a devDependency`);
  }
});

test('Tailwind v4 config uses the project stylesheet', () => {
  const config = read('prettier.config.mjs');
  assert.match(config, /tailwindStylesheet:\s*['"]\.\/app\/globals\.css['"]/);
  assert.match(config, /prettier-plugin-tailwindcss/);
});

test('ESLint disables conflicting stylistic rules after Next config', () => {
  const config = read('eslint.config.mjs');
  assert.match(config, /eslint-config-prettier\/flat/);
  assert.ok(config.indexOf('eslintConfigPrettier,') > config.indexOf('...nextTs,'));
});

test('Ignore list retains Markdown imports and generated files', () => {
  const ignore = read('.prettierignore');
  for (const pattern of [
    'examples/**/*.md',
    'next-env.d.ts',
    'node_modules/',
    '.next/',
    'CHECKPOINT_CP*.md',
  ]) {
    assert.ok(ignore.includes(pattern), `missing ignore rule ${pattern}`);
  }
});
