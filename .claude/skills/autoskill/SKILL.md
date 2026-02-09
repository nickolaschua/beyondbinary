---
name: autoskill
description: Analyzes coding sessions to extract durable preferences from corrections and approvals, then proposes targeted updates to skills that were active during the session.
---

# Autoskill: Learning from Sessions

This skill acts as a learning mechanism across sessions.

## Signal Detection

Look for these patterns in the conversation:
- "No, use X instead of Y"
- "We always do it this way"
- "Don't use X in this codebase"
- "That's wrong, here's how it actually works"
- User corrections followed by successful completion
- Repeated patterns in what user approves

## Signal Quality Filters

Before proposing a skill update, verify:
1. Is this new information Claude wouldn't already know?
2. Is this a durable preference (not one-time)?
3. Does this apply broadly or just to this specific case?
4. Would this help future sessions?

## Applying Changes

When proposing updates:
1. Identify the target skill file
2. Propose minimal, focused additions
3. Show exact text to add and where
4. If git is available, propose a commit message

## Output Format

```
## Proposed Skill Update

**Target:** .claude/skills/[skill-name]/SKILL.md

**Signals detected:**
- [Quote from conversation that triggered this]

**Proposed addition:**
[Exact text to add to the skill]

**Justification:**
[Why this should be a permanent update]
```

## Invocation

Run this skill at the end of coding sessions:
- "Run autoskill to analyze this session"
- "What should we add to our skills based on this session?"
