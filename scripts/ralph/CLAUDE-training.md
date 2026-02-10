# Ralph Agent Instructions — Stream 3: Training Pipeline (TDD Mode)

You are an autonomous coding agent working on the **training pipeline** for SenseAI.

## Scope

You ONLY modify these files:
- `ml/train_model.py` — LSTM training pipeline
- `ml/verify_data.py` — pre-training data quality verification
- `ml/tests/test_train_*.py` or `ml/tests/test_verify_*.py` — your test files

Do NOT modify: `utils.py`, `ws_server.py`, `collect_data.py`, `test_realtime.py`, or anything outside `ml/`.

## Your Task (TDD Workflow)

1. Read `docs/PRD.md` for project context
2. Read `docs/streams/TODO-training.md` and pick the **first unchecked** task (not `ALL_TASKS_COMPLETE`)
3. **RED** — Write a failing test first:
   - Create the test in `ml/tests/` using pytest
   - Run ONLY the new test file: `cd ml && python -m pytest tests/test_<name>.py -x -q --tb=short`
   - You MUST see FAILED output. Copy the failure line into your reasoning.
   - If the test passes immediately, your test is not testing new behavior — delete it and rewrite.
   - Do NOT proceed to step 4 until you have a confirmed test failure.
4. **GREEN** — Write the MINIMUM code to make the test pass:
   - Do NOT write implementation code before you have a failing test. No exceptions.
   - Modify only `ml/train_model.py` or `ml/verify_data.py`
   - Run the same test file again, confirm it PASSES
   - If it still fails, fix the implementation — do NOT weaken the test
5. **VERIFY** — Run the full test suite:
   - `cd ml && python -m pytest tests/ -q --tb=short`
   - ALL tests must pass. If any fail, fix before proceeding.
6. **COMMIT** — Only if all tests pass:
   - `git add` the test file(s) and source file(s) you changed
   - Commit with message: `feat(training): <short task description>`
7. Mark the task done in `docs/streams/TODO-training.md` (`- [ ]` → `- [x]`)
8. Commit the TODO update: `git add docs/streams/TODO-training.md && git commit -m "chore(training): mark task done"`

## Stop Condition

After completing a task, check if ALL tasks (except ALL_TASKS_COMPLETE) are checked.

If ALL tasks are complete:
1. Mark `- [x] ALL_TASKS_COMPLETE` in `docs/streams/TODO-training.md`
2. Commit: `chore(training): mark ALL_TASKS_COMPLETE`

If unchecked tasks remain, end your response normally.

## Quality Rules

- Every commit must have all tests green. Never commit broken code.
- Do NOT use webcam, GPU, or network in tests — mock external dependencies.
- Do NOT import TensorFlow in tests unless absolutely necessary (it's slow to import).
- Keep changes minimal and focused on the single task.
- Import constants from `ml/utils.py` — do not duplicate them.
- ONE task per iteration. Test FIRST, implement SECOND.
