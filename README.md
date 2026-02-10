# BeyondBinary

## ML Pipeline (SenseAI)

ASL sign language detection pipeline: webcam frames → MediaPipe Holistic landmarks → LSTM classification → WebSocket predictions.

### Quick Start

```bash
# Create Python 3.12 venv (system Python 3.13 is NOT compatible with MediaPipe)
py -3.12 -m venv ml/venv

# Install dependencies
ml\venv\Scripts\pip.exe install -r ml/requirements.txt

# Verify environment
cd ml && venv\Scripts\python.exe test_setup.py

# Start WebSocket server
cd ml && venv\Scripts\python.exe ws_server.py
```

### Dependencies

All versions are pinned in `ml/requirements.txt`. The version constraints form a chain — do not upgrade individual packages without checking compatibility.

| Package | Version | Why This Version |
|---------|---------|------------------|
| **mediapipe** | 0.10.21 | Last version with `mp.solutions.holistic` legacy API. v0.10.30+ removed it. |
| **tensorflow** | 2.16.2 | mediapipe 0.10.21 requires `numpy<2`. TF 2.17+ requires `numpy>=2`. |
| **numpy** | 1.26.4 | Constrained by mediapipe's `numpy<2` requirement. |
| **opencv-python** | 4.11.0.86 | Compatible with numpy 1.26.4. |
| **fastapi** | 0.128.6 | WebSocket server framework. |
| **uvicorn** | 0.40.0 | ASGI server for FastAPI. |
| **websockets** | 16.0 | WebSocket client for testing. |
| **python-multipart** | 0.0.22 | Form data handling for FastAPI. |
| **scikit-learn** | 1.6.1 | Train/test splitting, evaluation metrics. |
| **matplotlib** | 3.10.8 | Training visualization, confusion matrices. |

**Python version:** 3.12 only. MediaPipe 0.10.21 supports 3.9-3.12. System Python 3.13 is not compatible.

---

## Overnight Ralph Loop (Docker)

Ralph is an autonomous AI agent loop that runs Claude Code repeatedly, completing one task per iteration from `docs/TODO.md` until all tasks are done.

### Setup

#### 1. Fill in your task list

Edit `docs/PRD.md` with your project requirements and context.

Edit `docs/TODO.md` with your task list as checkboxes:

```markdown
- [ ] Implement feature X
- [ ] Add tests for feature X
- [ ] Update documentation
- [ ] ALL_TASKS_COMPLETE
```

Keep `- [ ] ALL_TASKS_COMPLETE` as the **last line**. Ralph marks it `[x]` when everything above is done, then the loop exits.

#### 2. Set environment variables

Create a `.env` file (not committed to git):

```bash
# Claude API credentials
ANTHROPIC_API_KEY=sk-ant-...
```

#### 3. Run the loop

**Single iteration** (test run):

```bash
make ralph-once
```

**Overnight / AFK run** (20 iterations):

```bash
make ralph-afk
```

Logs are saved to `logs/ralph-YYYYMMDD.log`.

#### 4. Stop the loop

```bash
docker compose down
```

Or press `Ctrl+C` in the terminal running it.

### How it works

Each iteration:
1. Claude Code reads `docs/TODO.md` and picks the first unchecked task
2. Implements it, runs verification
3. Commits the changes
4. Marks the task as done in `docs/TODO.md`
5. Repeats until `ALL_TASKS_COMPLETE` is checked

### Claude Code flags

The loop uses `claude --dangerously-skip-permissions --print` for unattended operation:
- `--dangerously-skip-permissions` auto-accepts all file edits and tool calls (no interactive prompts)
- `--print` outputs results to stdout (non-interactive mode)

### Files

| File | Purpose |
|------|---------|
| `scripts/ralph/ralph.sh` | The bash loop that spawns fresh Claude instances |
| `scripts/ralph/CLAUDE.md` | Prompt template fed to Claude each iteration |
| `docs/PRD.md` | Product requirements (context for Claude) |
| `docs/TODO.md` | Task list with checkboxes (the work queue) |
| `vendor/ralph-loop/` | Vendored original ralph repo for reference |
| `Dockerfile` | Container image with bash, git, curl, node, python |
| `docker-compose.yml` | Mounts repo at /workspace, runs as non-root |
| `Makefile` | `ralph-once` and `ralph-afk` targets |
