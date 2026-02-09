# Overseer: You (5th Instance)

## Working Directory
```
C:\Users\nicko\Desktop\beyondbinary\beyondbinary
```

## Branch
`nickolas` (main working branch)

## Your Role
You oversee all 4 agents, merge their work, do Phase 4 (manual data recording), and resolve any conflicts.

## Directory Layout
```
C:\Users\nicko\Desktop\beyondbinary\
├── beyondbinary/                              ← YOU (nickolas branch)
└── worktrees/
    ├── agent-1-foundation/                    ← Agent 1 (agent/foundation)
    ├── agent-2-data-pipeline/                 ← Agent 2 (agent/data-pipeline)
    ├── agent-3-model-training/                ← Agent 3 (agent/model-training)
    └── agent-4-serving/                       ← Agent 4 (agent/serving)
```

## Launch Order

All 4 agents can start simultaneously. They write against known interfaces.

1. Open 4 terminals/Claude instances
2. Each one `cd` into their worktree directory
3. Paste the agent plan as the first prompt
4. Let them work

## Merge Order (AFTER agents finish)

Merge sequentially to resolve any conflicts cleanly:

```bash
cd C:\Users\nicko\Desktop\beyondbinary\beyondbinary

# 1. Merge foundation first (everything depends on it)
git merge agent/foundation --no-ff -m "merge: agent-1 foundation (env setup + utils)"

# 2. Merge data pipeline
git merge agent/data-pipeline --no-ff -m "merge: agent-2 data pipeline (collect + verify)"

# 3. Merge model training
git merge agent/model-training --no-ff -m "merge: agent-3 model training (LSTM notebook)"

# 4. Merge serving last (depends on all others)
git merge agent/serving --no-ff -m "merge: agent-4 serving (inference + WebSocket)"
```

## Your Manual Work: Phase 4 (Data Recording)

After Agent 1 + Agent 2 are merged:

```bash
cd ml
.\venv\Scripts\activate
python collect_data.py
```

- Record all 10 signs in front of webcam
- 30 sequences × 30 frames each per sign
- ~15-20 minutes total
- Watch ASL reference videos first for each sign
- Then verify:

```bash
python verify_data.py
```

## Monitoring Progress

Check each agent's status:
```bash
# From main repo
cd C:\Users\nicko\Desktop\beyondbinary\beyondbinary

# Check Agent 1
git log agent/foundation --oneline -5

# Check Agent 2
git log agent/data-pipeline --oneline -5

# Check Agent 3
git log agent/model-training --oneline -5

# Check Agent 4
git log agent/serving --oneline -5
```

## After All Merged + Data Recorded

1. Upload `MP_Data.zip` to Google Drive
2. Open `training_notebook.ipynb` in Colab
3. Train model (should take <10 min on T4 GPU)
4. Download `action_model.h5` to `ml/models/`
5. Test: `python test_realtime.py`
6. Start server: `uvicorn ws_server:app --port 8001`
7. Test: `python test_ws_client.py`

## Cleanup (After All Done)

```bash
git worktree remove ../worktrees/agent-1-foundation
git worktree remove ../worktrees/agent-2-data-pipeline
git worktree remove ../worktrees/agent-3-model-training
git worktree remove ../worktrees/agent-4-serving
git worktree prune
```
