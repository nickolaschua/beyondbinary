---
name: git-worktrees
description: Use when setting up parallel development environments or when multiple team members need isolated workspaces. Creates separate working directories from the same repository.
---

# Git Worktrees for Parallel Development

Git worktrees let you have multiple working directories from a single repository. Essential for hackathons where team members work on different features simultaneously.

## Why Worktrees?

| Problem | Solution with Worktrees |
|---------|------------------------|
| Switching branches loses work | Each worktree has its own branch |
| Multiple Claude sessions conflict | Each session works in separate directory |
| Can't test two features at once | Run both simultaneously |
| Context switching overhead | No stashing, no branch switching |

## Setup for Hackathon Team

### Initial Setup (Team Lead)

```bash
# From main repo directory
cd your-hackathon-project

# Create worktrees directory (outside repo)
mkdir -p ../worktrees

# Create worktree for each team member
git worktree add ../worktrees/member-1 -b feature/member-1
git worktree add ../worktrees/member-2 -b feature/member-2
git worktree add ../worktrees/member-3 -b feature/member-3
git worktree add ../worktrees/member-4 -b feature/member-4
```

### Resulting Structure

```
parent-directory/
├── your-hackathon-project/     # Main repo (team lead)
│   └── .git/
└── worktrees/
    ├── member-1/               # Team member 1's workspace
    ├── member-2/               # Team member 2's workspace
    ├── member-3/               # Team member 3's workspace
    └── member-4/               # Team member 4's workspace
```

## Daily Workflow

### Starting Work

```bash
# Navigate to your worktree
cd ../worktrees/member-1

# Ensure you're on your branch
git branch  # Should show feature/member-1

# Start Claude Code
claude
```

### Syncing with Main

```bash
# Fetch latest changes
git fetch origin

# Merge main into your feature branch
git merge origin/main

# Or rebase (cleaner history)
git rebase origin/main
```

### Creating PR

```bash
# Push your branch
git push origin feature/member-1

# Create PR via GitHub (or use GitHub MCP)
```

### After PR Merged

```bash
# Switch to new feature
git checkout -b feature/new-task

# Or create new worktree for next task
git worktree add ../worktrees/member-1-task-2 -b feature/task-2
```

## Commands Reference

| Command | What It Does |
|---------|--------------|
| `git worktree list` | Show all worktrees |
| `git worktree add <path> -b <branch>` | Create new worktree with new branch |
| `git worktree add <path> <existing-branch>` | Create worktree from existing branch |
| `git worktree remove <path>` | Remove worktree (keeps branch) |
| `git worktree prune` | Clean up stale worktree references |

## Running Multiple Claude Sessions

```bash
# Terminal 1: Working on auth
cd ../worktrees/member-1
claude
# Work on authentication feature

# Terminal 2: Working on dashboard
cd ../worktrees/member-2  
claude
# Work on dashboard feature

# Both run simultaneously without conflicts!
```

## Common Issues

### "Branch already checked out"

```bash
# Error: branch 'feature/x' is already checked out
# Solution: Each branch can only be in one worktree

# Create new branch for worktree
git worktree add ../worktrees/new-task -b feature/new-task
```

### Worktree Out of Sync

```bash
# Pull latest in worktree
cd ../worktrees/member-1
git fetch origin
git rebase origin/main
```

### Cleaning Up After Hackathon

```bash
# Remove all worktrees
git worktree remove ../worktrees/member-1
git worktree remove ../worktrees/member-2
# ... etc

# Or remove entire worktrees directory
rm -rf ../worktrees
git worktree prune
```

## Best Practices

1. **One worktree per feature/person** — Prevents conflicts
2. **Sync with main frequently** — Avoid merge hell at the end
3. **Keep worktrees in parent directory** — Not inside repo
4. **Name branches clearly** — `feature/member-1-auth` better than `feature/stuff`
5. **Clean up after merging** — Remove stale worktrees

## Integration with Claude Code Sessions

Each Claude Code session should:
1. Run in its own worktree
2. Have clear task boundaries
3. Not modify files in other worktrees
4. Create PRs from its own branch

This enables true parallel development with AI assistance.
