#!/bin/bash
# Sets up 4 git worktrees for parallel Ralph loops.
# Each worktree gets its own branch, TODO file, and scoped CLAUDE.md.
#
# Usage: ./scripts/ralph/parallel-setup.sh
# Then:  ./scripts/ralph/parallel-run.sh [max_iterations]

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKTREE_DIR="$(dirname "$REPO_ROOT")"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

STREAMS=("ws" "utils" "training" "collection")

echo "=== Ralph Parallel Setup ==="
echo "Repo root:    $REPO_ROOT"
echo "Worktree dir: $WORKTREE_DIR"
echo ""

cd "$REPO_ROOT"

for stream in "${STREAMS[@]}"; do
  BRANCH="ralph/$stream"
  TREE_PATH="$WORKTREE_DIR/ralph-$stream"

  echo "--- Setting up stream: $stream ---"

  # Create branch from current HEAD if it doesn't exist
  if ! git show-ref --verify --quiet "refs/heads/$BRANCH"; then
    echo "  Creating branch $BRANCH"
    git branch "$BRANCH"
  else
    echo "  Branch $BRANCH already exists"
  fi

  # Create worktree if it doesn't exist
  if [ -d "$TREE_PATH" ]; then
    echo "  Worktree $TREE_PATH already exists, skipping"
  else
    echo "  Creating worktree at $TREE_PATH"
    git worktree add "$TREE_PATH" "$BRANCH"
  fi

  # Copy scoped CLAUDE.md into the worktree
  echo "  Copying CLAUDE-$stream.md → scripts/ralph/CLAUDE.md"
  cp "$SCRIPT_DIR/CLAUDE-$stream.md" "$TREE_PATH/scripts/ralph/CLAUDE.md"

  # Copy stream TODO as the main TODO.md
  echo "  Copying TODO-$stream.md → docs/TODO.md"
  cp "$REPO_ROOT/docs/streams/TODO-$stream.md" "$TREE_PATH/docs/TODO.md"

  # Link the venv so each worktree can run tests
  if [ -d "$REPO_ROOT/ml/venv" ] && [ ! -e "$TREE_PATH/ml/venv" ]; then
    echo "  Linking ml/venv"
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
      # Windows: use junction via PowerShell (works without admin, handles paths correctly)
      WIN_TARGET="$(cygpath -w "$REPO_ROOT/ml/venv")"
      WIN_LINK="$(cygpath -w "$TREE_PATH/ml/venv")"
      powershell -Command "New-Item -ItemType Junction -Path '$WIN_LINK' -Target '$WIN_TARGET'" > /dev/null
    else
      ln -s "$REPO_ROOT/ml/venv" "$TREE_PATH/ml/venv"
    fi
  fi

  echo "  Done: $TREE_PATH on branch $BRANCH"
  echo ""
done

echo "=== Setup complete ==="
echo ""
echo "Worktrees created:"
for stream in "${STREAMS[@]}"; do
  echo "  ralph-$stream → $WORKTREE_DIR/ralph-$stream (branch: ralph/$stream)"
done
echo ""
echo "Run: ./scripts/ralph/parallel-run.sh [max_iterations]"
