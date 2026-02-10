# Task List — ML Lead (Consolidated)

<!-- Cleaned-up task list. For parallel execution, see docs/streams/. -->

## Completed

- [x] Set up pytest infrastructure
- [x] Test extract_keypoints edge cases
- [x] Test and fix decode_frame
- [x] Test and fix load_data
- [x] Deduplicate constants
- [x] Extract stability filter
- [x] Test and fix model loading
- [x] Centralize config with env var overrides

## Remaining (split into 4 parallel streams)

See `docs/streams/` for per-stream TODO files used by parallel Ralph loops.

### Stream 1: ws_server.py
- [ ] Harden decode_frame (specific exceptions + data URL validation + 5MB limit)
- [ ] Per-client frame rate limiting
- [ ] Inference timing in response JSON
- [ ] Migrate to lifespan context manager

### Stream 2: utils.py
- [ ] Runtime keypoint shape assertion
- [ ] Resolve DATA_PATH relative to __file__
- [ ] Type hints on all public functions

### Stream 3: train_model.py + verify_data.py
- [ ] Specific exceptions in load_data
- [ ] --learning_rate CLI arg
- [ ] verify_data.py CLI args (--data_path, --min_hands)

### Stream 4: collect_data.py + test_realtime.py
- [ ] --actions arg for collect_data.py
- [ ] --num_sequences arg for collect_data.py
- [ ] --model_path arg for test_realtime.py
