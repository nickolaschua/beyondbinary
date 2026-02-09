# Codebase Structure

**Analysis Date:** 2026-02-10

## Directory Layout

```
beyondbinary/
├── .claude/                # Claude Code settings and agent profiles
│   ├── agents/            # Agent definitions (build-validator, code-simplifier, etc.)
│   ├── commands/          # Custom commands (code-review, create-component, etc.)
│   ├── skills/            # Specialized skills (debugging, TDD, git-worktrees, etc.)
│   ├── settings.json      # Code formatting hooks and permissions
│   └── settings.local.json
├── .context/              # Team context documents
│   ├── frontend-team-claude-md.md
│   ├── ml-lead-claude-md.md
│   └── sprint-plan.md
├── .planning/             # Project planning and roadmap
│   ├── agent-plans/       # Per-agent execution breakdowns
│   ├── codebase/          # Codebase analysis documents (this directory)
│   ├── config.json        # Planning tool configuration
│   ├── PROJECT.md         # Project specification
│   ├── ROADMAP.md         # 10-phase execution roadmap
│   └── STATE.md           # Current execution state
├── ml/                    # *** CORE ML PIPELINE ***
│   ├── models/            # Trained model artifacts (.gitkeep)
│   ├── collect_data.py    # Phase 3: Webcam data collection
│   ├── train_model.py     # Phase 6: LSTM training (local CPU)
│   ├── training_notebook.ipynb  # Phase 6: LSTM training (Colab GPU)
│   ├── test_realtime.py   # Phase 7: Standalone inference test
│   ├── ws_server.py       # Phase 8: FastAPI WebSocket server
│   ├── verify_data.py     # Phase 5: Data quality verification
│   ├── test_setup.py      # Phase 1-2: Environment verification
│   ├── test_ws_client.py  # Phase 9: WebSocket client test
│   ├── test_ws_health.py  # Phase 9: Health endpoint test
│   ├── utils.py           # Phase 2: Shared utilities (CRITICAL)
│   ├── requirements.txt   # Python 3.12-compatible dependencies
│   ├── troubleshooting_training.md
│   └── .gitignore         # ML-specific ignores (MP_Data/, models/, logs/)
├── notebook1_nick.ipynb   # Personal exploration notebook (Nick)
├── notebook2_somyansh.ipynb  # Personal exploration notebook (Somyansh)
└── .gitignore             # Root git ignore rules
```

## Directory Purposes

**ml/:**
- Purpose: Core ML pipeline for ASL sign language detection
- Contains: Python scripts for data collection, training, inference, and serving
- Key files: `utils.py` (shared contract), `ws_server.py` (production server), `train_model.py` (training)
- Subdirectories: `models/` (trained model artifacts, gitignored except .gitkeep)

**.planning/:**
- Purpose: Project management and documentation
- Contains: Project spec, roadmap, execution state, agent plans
- Key files: `PROJECT.md` (spec), `ROADMAP.md` (phases), `STATE.md` (progress)
- Subdirectories: `agent-plans/` (per-agent breakdowns), `codebase/` (this analysis)

**.context/:**
- Purpose: Team coordination and role context
- Contains: ML lead context, frontend team interface spec, sprint plan
- Key files: `ml-lead-claude-md.md`, `sprint-plan.md`

**.claude/:**
- Purpose: Claude Code IDE configuration
- Contains: Agent profiles, custom commands, skills, settings
- Subdirectories: `agents/`, `commands/`, `skills/`

## Key File Locations

**Entry Points:**
- `ml/ws_server.py` - WebSocket server (production entry point, port 8001)
- `ml/collect_data.py` - Data collection (interactive webcam recording)
- `ml/train_model.py` - Model training (local CPU)
- `ml/training_notebook.ipynb` - Model training (Google Colab GPU)
- `ml/test_realtime.py` - Real-time inference verification

**Configuration:**
- `ml/requirements.txt` - Python dependencies (pinned versions)
- `ml/utils.py` - Shared constants (ACTIONS, SEQUENCE_LENGTH, MODEL_PATH)
- `.planning/config.json` - Planning tool configuration

**Core Logic:**
- `ml/utils.py` - MediaPipe detection, keypoint extraction, shared constants
- `ml/ws_server.py` - FastAPI server, frame decoding, LSTM inference, stability filtering
- `ml/train_model.py` - LSTM architecture, training loop, evaluation

**Testing:**
- `ml/test_setup.py` - Environment verification (imports, webcam, MediaPipe, utils contract)
- `ml/verify_data.py` - Data quality verification (shapes, hand detection rates)
- `ml/test_ws_client.py` - WebSocket client test with latency measurement
- `ml/test_ws_health.py` - HTTP health endpoint check
- `ml/test_realtime.py` - Standalone webcam inference test

**Documentation:**
- `.planning/PROJECT.md` - Project specification and decisions
- `.planning/ROADMAP.md` - 10-phase execution roadmap
- `ml/troubleshooting_training.md` - Training troubleshooting guide

## Naming Conventions

**Files:**
- `snake_case.py` for all Python modules (`train_model.py`, `ws_server.py`, `collect_data.py`)
- `test_*.py` prefix for test/verification scripts (`test_setup.py`, `test_ws_client.py`)
- `verify_*.py` for data quality scripts (`verify_data.py`)
- `*_notebook.ipynb` for Jupyter notebooks (`training_notebook.ipynb`)
- `UPPERCASE.md` for important planning docs (`PROJECT.md`, `ROADMAP.md`, `STATE.md`)

**Directories:**
- `snake_case` or `kebab-case` for all directories
- Plural for collections (`models/`, `agents/`, `commands/`)
- Dot-prefix for metadata (`.planning/`, `.context/`, `.claude/`)

**Special Patterns:**
- `utils.py` - Shared utility module (single file, not a package)
- `requirements.txt` - Standard pip dependency manifest
- `.gitkeep` - Placeholder for empty directories tracked by git

## Where to Add New Code

**New ML Pipeline Script:**
- Primary code: `ml/`
- Tests: `ml/test_*.py` (co-located)
- Import shared constants from: `ml/utils.py`

**New ASL Sign (Extending ACTIONS):**
- Update constants: `ml/utils.py` (ACTIONS array)
- Re-record data: `ml/collect_data.py`
- Re-verify: `ml/verify_data.py`
- Re-train: `ml/train_model.py` or `ml/training_notebook.ipynb`

**New WebSocket Endpoint:**
- Implementation: `ml/ws_server.py` (add route)
- Test: `ml/test_ws_client.py` or new `ml/test_ws_*.py`

**New Planning Document:**
- Implementation: `.planning/codebase/` or `.planning/`
- Follow existing UPPERCASE.md convention

## Special Directories

**MP_Data/ (gitignored):**
- Purpose: Recorded keypoint sequences for training
- Source: Generated by `ml/collect_data.py`
- Structure: `MP_Data/{action}/{sequence}/{frame}.npy`
- Size: ~180 MB (9,000 .npy files)
- Committed: No (in `.gitignore`)

**models/ (gitignored):**
- Purpose: Trained LSTM model artifacts
- Source: Generated by `ml/train_model.py` or Colab notebook
- Contains: `action_model.h5`, `action_model_savedmodel/`, `best_model.h5`
- Size: ~50-100 MB per model
- Committed: No (in `ml/.gitignore`, only `.gitkeep` tracked)

**logs/ (gitignored):**
- Purpose: TensorBoard training logs
- Source: Generated by `ml/train_model.py`
- Contains: `logs/{timestamp}/events.out.tfevents.*`
- View: `tensorboard --logdir logs/`
- Committed: No

**.git/worktrees/:**
- Purpose: Git worktrees for parallel agent development branches
- Contains: `agent-1-foundation/`, `agent-2-data-pipeline/`, `agent-3-model-training/`, `agent-4-serving/`
- Committed: No (git internal)

---

*Structure analysis: 2026-02-10*
*Update when directory structure changes*
