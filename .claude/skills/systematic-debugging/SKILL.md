---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior. MUST be used before proposing fixes. Provides structured debugging methodology to find root causes.
---

# Systematic Debugging

**CRITICAL: Complete each phase before proceeding. Violating this process means violating good debugging.**

## Phase 1: Reproduce & Observe (DO NOT SKIP)

Before ANY fix attempts:

1. **Reproduce the bug consistently**
   - Document exact steps to trigger
   - Note any variations in behavior
   - Identify minimum reproduction case

2. **Gather evidence at component boundaries**
   ```
   For EACH component boundary:
   - Log what data enters
   - Log what data exits
   - Verify environment/config
   - Check state at each layer
   ```

3. **Document observations**
   - Error messages (exact text)
   - Stack traces
   - Console output
   - Network requests/responses

## Phase 2: Isolate the Failure Point

After Phase 1 evidence is gathered:

1. **Trace backward from symptom**
   - Start at the error
   - Work backward through call stack
   - Find first point where behavior diverges from expected

2. **Binary search for location**
   - If large codebase, bisect to narrow scope
   - Comment out sections to isolate
   - Use git bisect if regression

3. **Identify the specific failing component**
   - One component should emerge as suspect
   - Verify by checking inputs/outputs

## Phase 3: Understand Root Cause

Before writing any fix:

1. **Read relevant code completely**
   - Not just the failing line
   - Understand surrounding context
   - Check related functions/modules

2. **Form hypothesis**
   - Why does this specific input cause failure?
   - What assumption was violated?
   - Is this a symptom or the actual cause?

3. **Verify hypothesis**
   - Add targeted logging
   - Use debugger if needed
   - Confirm root cause before proceeding

## Phase 4: Fix and Verify

Only after Phases 1-3:

1. **Make minimal fix**
   - Change only what's necessary
   - Don't refactor during bug fix
   - One logical change

2. **Verify fix works**
   - Run original reproduction steps
   - Confirm bug is gone
   - Run related tests

3. **Check for regressions**
   - Run full test suite
   - Manually test related features
   - Consider edge cases

## Anti-Patterns (DO NOT DO)

| Bad | Why | Instead |
|-----|-----|---------|
| Guess and change random things | Creates new bugs, wastes time | Follow Phase 1-3 first |
| Multiple changes at once | Can't tell what fixed it | One change, verify, repeat |
| Skip reproduction | Bug might be environmental | Always reproduce first |
| Fix symptoms not causes | Bug will return | Find actual root cause |
| Assume you know the cause | Overconfidence = wrong fixes | Gather evidence first |

## Quick Reference

```
Bug reported
    ↓
Phase 1: Reproduce + gather evidence
    ↓
Phase 2: Isolate failing component
    ↓
Phase 3: Understand root cause
    ↓
Phase 4: Minimal fix + verify
    ↓
Done
```

## When to Escalate

After 3+ fix attempts fail:
- Question the architecture
- Discuss with team before more attempts
- Consider if this is a deeper design issue

**Remember:** Systematic debugging is FASTER than guess-and-check. The process feels slow but saves time overall.
