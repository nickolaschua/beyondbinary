# Task List — Stream 2: utils.py

<!-- Ralph picks the first unchecked task each iteration. TDD: write failing test, then implement. -->
<!-- SCOPE: Only modify utils.py and ml/tests/test_utils_*.py -->

- [ ] Add runtime keypoint shape assertion: in utils.py extract_keypoints(), concatenate into a local variable `result`, add `assert result.shape == (1662,), f"extract_keypoints produced shape {result.shape}, expected (1662,)"` before returning. Write ml/tests/test_utils_assertion.py verifying (a) normal extraction with mock results returns (1662,) without error, (b) monkeypatch np.concatenate to return wrong shape → raises AssertionError with the shape info in the message.
- [ ] Resolve DATA_PATH relative to __file__: change `DATA_PATH = os.path.join('MP_Data')` to `DATA_PATH = os.path.join(_ML_DIR, 'MP_Data')` using the existing `_ML_DIR` variable, so it resolves correctly regardless of working directory (matching how MODEL_PATH already works). Write ml/tests/test_utils_paths.py verifying (a) DATA_PATH is an absolute path, (b) DATA_PATH ends with 'MP_Data', (c) MODEL_PATH is an absolute path, (d) both paths share the same parent directory.
- [ ] Add type hints to all public functions: add parameter and return type annotations to `mediapipe_detection`, `draw_landmarks`, `extract_keypoints`, and all `StabilityFilter` methods. Use `np.ndarray` for arrays, `Any` for MediaPipe types that lack stubs. Do NOT change any logic or behavior. Write ml/tests/test_utils_types.py that uses `inspect.signature()` to verify (a) extract_keypoints has a return annotation, (b) mediapipe_detection has parameter annotations, (c) StabilityFilter.update has both parameter and return annotations. Verify all existing tests still pass.
- [ ] ALL_TASKS_COMPLETE
