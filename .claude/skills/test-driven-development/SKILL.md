---
name: test-driven-development
description: Use when implementing any feature or bugfix. Write failing test first, then implementation, then refactor. Ensures code works correctly from the start.
---

# Test-Driven Development (TDD)

**The Iron Law: No code without a failing test first.**

## The Cycle: RED → GREEN → REFACTOR

```
┌─────────────────────────────────────────────────────┐
│  RED: Write a failing test                          │
│       ↓                                             │
│  GREEN: Write minimal code to pass                  │
│       ↓                                             │
│  REFACTOR: Clean up while tests pass                │
│       ↓                                             │
│  (repeat)                                           │
└─────────────────────────────────────────────────────┘
```

## Phase 1: RED (Write Failing Test)

1. **Understand the requirement**
   - What should this code do?
   - What are the inputs and outputs?
   - What are the edge cases?

2. **Write ONE test**
   - Test the simplest case first
   - Be specific about expected behavior
   - Test name should describe the behavior

3. **Run the test — it MUST fail**
   - If it passes, something is wrong
   - Failure confirms test is valid

```typescript
// Example: Testing a login function
test('login returns user when credentials are valid', async () => {
  const result = await login('test@example.com', 'password123');
  expect(result.user).toBeDefined();
  expect(result.user.email).toBe('test@example.com');
});
```

## Phase 2: GREEN (Make It Pass)

1. **Write minimal code to pass**
   - Don't over-engineer
   - Don't add features not tested
   - Ugly code is fine (for now)

2. **Run the test — it MUST pass**
   - If it fails, fix the implementation
   - Don't change the test to pass

3. **Commit when green**
   - Small, working increments
   - Easy to revert if needed

## Phase 3: REFACTOR (Clean Up)

1. **Improve code quality**
   - Remove duplication
   - Improve naming
   - Simplify logic

2. **Tests must stay green**
   - Run tests after each change
   - If tests fail, undo refactor

3. **Don't add functionality**
   - Refactor ≠ new features
   - New features need new tests first

## Hackathon TDD Strategy

Given time pressure, focus TDD on:

| Priority | What to Test | Why |
|----------|--------------|-----|
| High | API endpoints | Core functionality, hard to debug |
| High | Data transformations | Easy to mess up, easy to test |
| Medium | UI state logic | Complex state = bugs |
| Low | Simple CRUD | Low risk, high time cost |

## Quick Test Patterns

**API endpoint test:**
```typescript
test('POST /api/users creates user', async () => {
  const response = await request(app)
    .post('/api/users')
    .send({ email: 'test@test.com', name: 'Test' });
  
  expect(response.status).toBe(201);
  expect(response.body.user.email).toBe('test@test.com');
});
```

**React component test:**
```typescript
test('Button calls onClick when clicked', () => {
  const handleClick = vi.fn();
  render(<Button onClick={handleClick}>Click me</Button>);
  
  fireEvent.click(screen.getByText('Click me'));
  
  expect(handleClick).toHaveBeenCalledOnce();
});
```

**Utility function test:**
```typescript
test('formatPrice adds currency symbol', () => {
  expect(formatPrice(1000)).toBe('$10.00');
  expect(formatPrice(0)).toBe('$0.00');
  expect(formatPrice(9999)).toBe('$99.99');
});
```

## Anti-Patterns (DO NOT DO)

| Bad | Why | Instead |
|-----|-----|---------|
| Write code first, test later | Tests become afterthought, bugs slip through | RED first, always |
| Write multiple tests at once | Lose focus, slower feedback | One test at a time |
| Test implementation details | Tests break when refactoring | Test behavior only |
| Skip refactor phase | Technical debt accumulates | Clean up while green |
| Change test to pass | Defeats purpose of testing | Fix implementation |

## When to Skip TDD (Hackathon Reality)

It's okay to skip TDD for:
- Prototype/throwaway code
- UI layout/styling
- One-off scripts
- Exploratory coding

But ALWAYS use TDD for:
- Core business logic
- API endpoints
- Data processing
- Anything going to production

## Commands

```bash
# Run single test
bun run test -- -t "test name"

# Run tests in watch mode
bun run test --watch

# Run tests for specific file
bun run test path/to/file.test.ts
```
