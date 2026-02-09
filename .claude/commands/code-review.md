# Code Review

Review all code changes from this session before creating a PR.

## Review Checklist

### Security
- [ ] No hardcoded secrets or API keys
- [ ] Input validation on all user inputs
- [ ] Proper authentication/authorization checks
- [ ] No SQL injection vulnerabilities
- [ ] XSS prevention in place

### Performance
- [ ] No unnecessary re-renders (React)
- [ ] Database queries are optimized
- [ ] No N+1 query problems
- [ ] Large lists are paginated
- [ ] Images and assets are optimized

### Error Handling
- [ ] All async operations have error handling
- [ ] User-friendly error messages
- [ ] Errors are logged appropriately
- [ ] Edge cases are handled

### Code Quality
- [ ] No dead code or unused imports
- [ ] Functions are reasonably sized (<50 lines)
- [ ] Variable names are clear and descriptive
- [ ] No code duplication
- [ ] Types are properly defined (TypeScript)

### Testing
- [ ] Critical paths have tests
- [ ] Edge cases are tested
- [ ] Tests actually test behavior, not implementation

## Output

Provide a summary:
- ✅ **Passes:** Areas that look good
- ⚠️ **Warnings:** Minor issues to consider
- ❌ **Blockers:** Must fix before PR

If blockers exist, fix them before proceeding.
