Prompt to paste into Claude Code
You are in my project repo root. Do NOT use the Ralph Wiggum plugin. Instead, vendor the original Ralph loop repo and wire it up locally.

High-level goal

Clone the “original Ralph loop” repo into vendor/ralph-loop/ (keep it vendored so I can inspect it).

Copy the loop runner + templates into scripts/ralph/ (tracked in git).

Add a Docker sandbox + docker-compose target to run the loop overnight.

The loop should do ONE task per iteration, run verification, commit, and repeat until the task list is fully checked.

Which repo to clone

Clone: https://github.com/snarktank/ralph.git into vendor/ralph-loop/ (this is the repo referenced in the “copy Ralph into your project” approach).
​

If that repo URL fails, stop and ask me for the exact URL (do not guess).

Files to copy into this repo

Create scripts/ralph/

Copy from vendor repo into scripts/ralph/:

ralph.sh

CLAUDE.md (or equivalent prompt/spec file if named differently)

Ensure scripts/ralph/ralph.sh is executable.

Docs / task list in my repo (authoritative)

Create docs/PRD.md template.

Create docs/TODO.md as the task list with checkboxes and include the final line exactly:

- [ ] ALL_TASKS_COMPLETE

The loop must stop only when TODO.md contains - [x] ALL_TASKS_COMPLETE.
​

Docker

Add Dockerfile + docker-compose.yml that:

Mounts this repo at /workspace

Runs as non-root

Installs bash, git, curl (and optionally node/python if you can do it cleanly)

Has an entrypoint or compose command to run: ./scripts/ralph/ralph.sh --tool claude <max-iterations>

Add .dockerignore.

Add .gitignore entries for .env, logs/, and any state folder the loop creates.

Makefile / commands

Add Make targets:

make ralph-once runs ONE iteration (max-iterations=1) inside docker compose.

make ralph-afk runs e.g. 20 iterations inside docker compose.

Log output to logs/ralph-YYYYMMDD.log.

Claude Code invocation (no plugin)

Use the claude CLI inside the container.

Ensure the run will not hang on interactive permission prompts: pass the appropriate Claude Code flags so edits are accepted automatically (document the exact flags you used in README). The goal is unattended overnight runs.

README

Append a section “Overnight Ralph Loop (Docker)” with:

How to fill docs/PRD.md and docs/TODO.md

How to set env vars for Claude credentials (via .env, not committed)

How to run make ralph-afk

How to stop it

Finish

Make one commit: chore: add dockerized ralph loop (vendored)

Then print exact commands I should run next.

Proceed now.