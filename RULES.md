# BMI Stellar Engineering Rules

## Line Count Discipline

Core code files must stay under 1000 lines of code.

This rule applies to:

- `*.ts`
- `*.js`
- `*.svelte`
- `*.css`
- other core source extensions if they are introduced later

This rule excludes:

- `*.md`
- `*.txt`
- generated output
- dependency folders
- build artifacts
- `.svelte-kit`
- `.vercel/output`
- `node_modules`
- `dist`
- `build`
- coverage
- `.git`

When a core file approaches the limit, split by domain, component, or service ownership. Do not perform cosmetic slicing just to move lines around.
