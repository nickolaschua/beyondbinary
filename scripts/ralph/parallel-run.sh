#!/bin/bash
# Launches 4 Ralph loops in parallel, one per worktree.
# Each runs on its own branch with its own scoped tasks.
#
# Usage: ./scripts/ralph/parallel-run.sh [max_iterations]
#
# Prerequisites: run parallel-setup.sh first.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORKTREE_DIR="$(dirname "$REPO_ROOT")"
MAX_ITERATIONS="${1:-10}"

STREAMS=("ws" "utils" "training" "collection")
PIDS=()

echo "=== Ralph Parallel Run ==="
echo "Max iterations per stream: $MAX_ITERATIONS"
echo ""

# Create logs directory
mkdir -p "$REPO_ROOT/logs"

for stream in "${STREAMS[@]}"; do
  TREE_PATH="$WORKTREE_DIR/ralph-$stream"
  LOGFILE="$REPO_ROOT/logs/ralph-$stream-$(date +%Y%m%d-%H%M%S).log"

  if [ ! -d "$TREE_PATH" ]; then
    echo "ERROR: Worktree not found: $TREE_PATH"
    echo "Run parallel-setup.sh first."
    exit 1
  fi

  echo "Starting stream: $stream"
  echo "  Worktree: $TREE_PATH"
  echo "  Log:      $LOGFILE"

  # Launch ralph.sh in the worktree, backgrounded
  (
    cd "$TREE_PATH"
    bash "./scripts/ralph/ralph.sh" --tool claude "$MAX_ITERATIONS" 2>&1 | tee "$LOGFILE"
  ) &

  PIDS+=($!)
  echo "  PID: ${PIDS[-1]}"
  echo ""

  # Stagger launches by 5 seconds to avoid API rate limits
  sleep 5
done

echo "=== All 4 streams launched ==="
echo ""
echo "PIDs: ${PIDS[*]}"
echo "Logs: $REPO_ROOT/logs/ralph-{ws,utils,training,collection}-*.log"
echo ""
echo "Monitor:  tail -f $REPO_ROOT/logs/ralph-*-*.log"
echo "Stop all: kill ${PIDS[*]}"
echo ""
echo "Waiting for all streams to finish..."

# Wait for all and report results
FAILED=0
for i in "${!STREAMS[@]}"; do
  stream="${STREAMS[$i]}"
  pid="${PIDS[$i]}"

  if wait "$pid"; then
    echo "  $stream: COMPLETED (PID $pid)"
  else
    echo "  $stream: FAILED or INCOMPLETE (PID $pid)"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
if [ $FAILED -eq 0 ]; then
  echo "=== All streams completed successfully ==="
else
  echo "=== $FAILED stream(s) failed or incomplete ==="
  echo "Check logs for details."
fi

echo ""
echo "Next steps:"
echo "  1. Review each branch: git log ralph/ws, git log ralph/utils, etc."
echo "  2. Merge into main:"
echo "     git merge ralph/utils      # merge utils first (other code depends on it)"
echo "     git merge ralph/training"
echo "     git merge ralph/collection"
echo "     git merge ralph/ws         # merge ws last (heaviest changes)"
echo "  3. Run full test suite: cd ml && python -m pytest tests/ -v"
echo "  4. Clean up worktrees: git worktree remove ../ralph-{ws,utils,training,collection}"
