# CP-019 — Project-wide formatting

## Scope

- `prettier.config.mjs` — Prettier 3 with the Tailwind CSS v4 plugin and `app/globals.css` as the stylesheet.
- `.prettierignore` — preserve raw import Markdown, checkpoint history, lockfiles, generated assets, secrets and dependencies.
- `.editorconfig` and `.vscode/` — consistent editor formatting across TS, TSX, JS, CSS, JSON, Markdown, YAML.
- `eslint.config.mjs` — load `eslint-config-prettier/flat` **last** among rule-bearing configs, preserving Next.js rules.
- `package.json` — new format commands and pinned formatter dev dependencies.

## Usage

```fish
cd ~/Documents/Project-Sites/Experiment/taskloom
npm install
npm run format
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

`npm run format:files -- path/to/file.tsx path/to/other.css` formats just the named files.

## Limitations

- The npm registry is unreachable in the patch-creation environment, so the formatter was **configured**, but it could not be installed or run there. The distributed source has not yet received a Prettier rewrite. Run `npm install` and `npm run format` locally.
- Package lockfile was not present in CP-018 and was not fabricated. `npm install` generates one; commit it for reproducible installs.
- Prettier handles only supported text formats; `.env` files, binary files, SVG images and lockfiles are deliberately excluded or skipped.
- Raw Markdown files under `examples/` retain their exact import formatting to avoid modifying fixtures.
- Historical `CHECKPOINT_CP*.md` files remain unchanged as audit artifacts.
- Tailwind class sorting may reorder classes; inspect class order in the UI after first format and verify theme behavior.

## Suggested commit message

`chore(formatting): add Prettier and Tailwind class sorting with ESLint parity`
