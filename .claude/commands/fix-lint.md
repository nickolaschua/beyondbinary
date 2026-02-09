# Fix Linting Errors

Run the linter and fix all errors in the codebase.

## Process

1. Run `bun run lint` to identify all errors
2. Fix each error systematically
3. Re-run linter to verify fixes
4. Run `bun run typecheck` to ensure no type errors were introduced

## Rules

- Do NOT disable linting rules unless absolutely necessary
- Prefer fixing the actual issue over suppressing warnings
- If a fix requires significant refactoring, note it but make minimal changes
- Keep the code style consistent with existing patterns

Report what was fixed when complete.
