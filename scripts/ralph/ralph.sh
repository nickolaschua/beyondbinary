#!/bin/bash
# Ralph Wiggum - Long-running AI agent loop (TDD mode)
# Usage: ./scripts/ralph/ralph.sh --tool claude [max_iterations]

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TODO_FILE="$REPO_ROOT/docs/TODO.md"

# Parse arguments
TOOL="claude"
MAX_ITERATIONS=10

while [[ $# -gt 0 ]]; do
  case $1 in
    --tool)
      TOOL="$2"
      shift 2
      ;;
    --tool=*)
      TOOL="${1#*=}"
      shift
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
      fi
      shift
      ;;
  esac
done

if [[ "$TOOL" != "claude" ]]; then
  echo "Error: Only 'claude' tool is supported in this setup."
  exit 1
fi

if [ ! -f "$TODO_FILE" ]; then
  echo "Error: $TODO_FILE not found. Create it first."
  exit 1
fi

# --- Find Python (venv or system) ---
find_python() {
  if [ -f "$REPO_ROOT/ml/venv/bin/python" ]; then
    echo "$REPO_ROOT/ml/venv/bin/python"
  elif [ -f "$REPO_ROOT/ml/venv/Scripts/python.exe" ]; then
    echo "$REPO_ROOT/ml/venv/Scripts/python.exe"
  else
    echo "python"
  fi
}

PYTHON=$(find_python)
echo "Starting Ralph - Tool: $TOOL - Max iterations: $MAX_ITERATIONS"
echo "TODO file: $TODO_FILE"
echo "Python: $PYTHON"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo ""
  echo "==============================================================="
  echo "  Ralph Iteration $i of $MAX_ITERATIONS ($TOOL)"
  echo "==============================================================="

  # Check if ALL_TASKS_COMPLETE is already checked before running
  if grep -q '\- \[x\] ALL_TASKS_COMPLETE' "$TODO_FILE"; then
    echo ""
    echo "All tasks already complete! (ALL_TASKS_COMPLETE is checked)"
    exit 0
  fi

  # Run Claude Code: --dangerously-skip-permissions for autonomous operation
  cd "$REPO_ROOT"
  OUTPUT=$(claude --dangerously-skip-permissions --print < "$SCRIPT_DIR/CLAUDE.md" 2>&1 | tee /dev/stderr) || true

  # --- VERIFICATION GATE: run tests independently ---
  echo ""
  echo "--- Verification Gate: running pytest ---"

  # Only run the gate if tests/ directory exists (task 1 creates it)
  if [ -d "$REPO_ROOT/ml/tests" ]; then
    cd "$REPO_ROOT/ml"
    if $PYTHON -m pytest tests/ -x -q --tb=short 2>&1; then
      echo "--- Verification PASSED ---"
    else
      echo ""
      echo "VERIFICATION FAILED: tests are broken after iteration $i"
      echo "Ralph is stopping to prevent further damage."
      echo "Review the last commit and fix manually."
      exit 1
    fi
    cd "$REPO_ROOT"
  else
    echo "--- Skipping (ml/tests/ not yet created) ---"
  fi

  # Check if ALL_TASKS_COMPLETE is now checked in TODO.md
  if grep -q '\- \[x\] ALL_TASKS_COMPLETE' "$TODO_FILE"; then
    echo ""
    echo "Ralph completed all tasks!"
    echo "Completed at iteration $i of $MAX_ITERATIONS"
    exit 0
  fi

  echo "Iteration $i complete. Continuing..."
  sleep 2
done

echo ""
echo "Ralph reached max iterations ($MAX_ITERATIONS) without completing all tasks."
echo "Check docs/TODO.md for remaining items."
exit 1
