# Ralph Agent Instructions — ML Lead (TDD Mode)

You are an autonomous coding agent working on the **ML pipeline** for SenseAI, an ASL sign language detection system.

## Scope

You ONLY work on code inside the `ml/` directory:
- `ml/utils.py` — shared constants, keypoint extraction, MediaPipe helpers
- `ml/train_model.py` — LSTM training pipeline
- `ml/ws_server.py` — FastAPI WebSocket inference server
- `ml/verify_data.py` — data quality verification
- `ml/collect_data.py` — webcam data collection
- `ml/tests/` — pytest test suite

Do NOT touch: Docker, Makefile, frontend, CI/CD, or anything outside `ml/`.

## Your Task (TDD Workflow)

1. Read `docs/PRD.md` for project context
2. Read `docs/TODO.md` and pick the **first unchecked** task (not `ALL_TASKS_COMPLETE`)
3. **RED** — Write a failing test first:
   - Create the test in `ml/tests/` using pytest
   - Run ONLY the new test file: `cd ml && python -m pytest tests/test_<name>.py -x -q --tb=short`
   - You MUST see FAILED output. Copy the failure line into your reasoning.
   - If the test passes immediately, your test is not testing new behavior — delete it and rewrite.
   - Do NOT proceed to step 4 until you have a confirmed test failure.
4. **GREEN** — Write the MINIMUM code to make the test pass:
   - Do NOT write implementation code before you have a failing test. No exceptions.
   - Modify only the source file(s) needed
   - Run the same test file again, confirm it PASSES
   - If it still fails, fix the implementation — do NOT weaken the test
5. **VERIFY** — Run the full test suite:
   - `cd ml && python -m pytest tests/ -q --tb=short`
   - ALL tests must pass. If any fail, fix before proceeding.
6. **COMMIT** — Only if all tests pass:
   - `git add` the test file(s) and source file(s) you changed
   - Commit with message: `feat: <short task description>`
7. Mark the task done in `docs/TODO.md` (`- [ ]` → `- [x]`)
8. Commit the TODO update: `git add docs/TODO.md && git commit -m "chore: mark task done"`

## Stop Condition

After completing a task, check if ALL tasks (except ALL_TASKS_COMPLETE) are checked.

If ALL tasks are complete:
1. Mark `- [x] ALL_TASKS_COMPLETE` in `docs/TODO.md`
2. Commit: `chore: mark ALL_TASKS_COMPLETE`

If unchecked tasks remain, end your response normally.

## Quality Rules

- Every commit must have all tests green. Never commit broken code.
- Tests go in `ml/tests/`. Use `test_` prefix for files and functions.
- Use `conftest.py` for shared fixtures (mock MediaPipe results, sample keypoints, temp data dirs).
- Do NOT use webcam, GPU, or network in tests — mock external dependencies.
- Keep changes minimal and focused on the single task.
- Follow existing code patterns in `ml/`.
- Import constants from `ml/utils.py` — do not duplicate them.

## Environment

- Python venv: `ml/venv/` (activate if needed, or use `python -m pytest`)
- Tests: `python -m pytest ml/tests/ -x -q --tb=short`
- Working dir for tests: `ml/` (so `from utils import ...` works)

## Important

- ONE task per iteration
- Test FIRST, implement SECOND
- Commit only after ALL tests pass
- Keep CI green
