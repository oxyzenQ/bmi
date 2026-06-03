# BMI Stellar Engineering Rules

## Line Count Discipline

Core code files must stay under 1000 lines of code.

This rule applies to:

- `*.ts`
- `*.svelte`
- `*.css`

This rule excludes:

- `*.md`
- `*.txt`

When a core file approaches the limit, split by domain, component, or service ownership. Do not perform cosmetic slicing just to move lines around.
