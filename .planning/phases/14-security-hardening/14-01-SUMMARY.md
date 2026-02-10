---
phase: 14-security-hardening
plan: 01
subsystem: security
tags: [cors, api-key, env-var-validation, fastapi, websocket]

# Dependency graph
requires:
  - phase: 13-error-handling
    provides: Specific exception handling, payload validation, model-load safety
provides:
  - Configurable CORS origins via SENSEAI_CORS_ORIGINS env var
  - Safe env var parsing with fallback defaults (_safe_int, _safe_float)
  - Optional API key auth on WebSocket via SENSEAI_API_KEY
affects: [18-protocol-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Safe env var parsing pattern: _safe_int/_safe_float with fallback defaults"
    - "Optional auth pattern: API_KEY=None disables, any value enables"
    - "Configurable CORS pattern: comma-separated origins from env var"

key-files:
  created: []
  modified:
    - ml/utils.py
    - ml/ws_server.py
    - ml/tests/test_config.py
    - ml/tests/test_ws_server.py

key-decisions:
  - "CORS defaults to ['*'] for backwards compatibility; production sets SENSEAI_CORS_ORIGINS"
  - "API key auth is opt-in (disabled by default) to not break existing dev workflow"
  - "API key passed as query param ?api_key=KEY (not header) for WebSocket compatibility"
  - "Invalid env var values silently fall back to defaults rather than crashing"

patterns-established:
  - "_safe_int/_safe_float: reusable pattern for validated env var parsing"
  - "Optional auth gate: check at WebSocket connect, close with 4003 if invalid"

issues-created: []

# Metrics
duration: 19min
completed: 2026-02-10
---

# Phase 14 Plan 01: Security Hardening Summary

**Configurable CORS origins, safe env var parsing, and optional API key auth on WebSocket connect**

## Performance

- **Duration:** 19 min
- **Started:** 2026-02-10T05:22:42Z
- **Completed:** 2026-02-10T05:41:15Z
- **Tasks:** 4
- **Files modified:** 4

## Accomplishments
- Env var conversions (`PORT`, `CONFIDENCE_THRESHOLD`, `STABILITY_WINDOW`) now use `_safe_int`/`_safe_float` helpers that fall back to defaults on invalid values
- CORS origins configurable via `SENSEAI_CORS_ORIGINS` env var (comma-separated), defaults to `["*"]` for backwards compatibility
- Optional API key authentication on WebSocket connect via `SENSEAI_API_KEY` env var — disabled by default, rejects with code 4003 when enabled and key is invalid/missing
- 17 new tests added (131 total, all passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add env var validation with safe fallbacks** - `9170d49` (feat)
2. **Task 2: Make CORS origins configurable via SENSEAI_CORS_ORIGINS** - `12cdae2` (feat)
3. **Task 3: Add optional API key auth on WebSocket connect** - `07a97d3` (feat)
4. **Task 4: Run full test suite** - (verification only, no commit)

**Plan metadata:** `320e7a3` (docs: complete plan)

## Files Created/Modified
- `ml/utils.py` - Added `_safe_int()`, `_safe_float()`, `CORS_ORIGINS`, `API_KEY` constants
- `ml/ws_server.py` - Imported `CORS_ORIGINS`/`API_KEY`, replaced hardcoded CORS, added auth gate
- `ml/tests/test_config.py` - Added 13 tests: invalid env vars, CORS origins, API key config
- `ml/tests/test_ws_server.py` - Added 4 tests: WebSocket auth with/without API key

## Decisions Made
- CORS defaults to `["*"]` for backwards compatibility — production deployments set `SENSEAI_CORS_ORIGINS`
- API key passed as query param (`?api_key=KEY`) rather than header, since WebSocket connections have limited header support in browsers
- Invalid env var values silently fall back to defaults rather than logging warnings — keeps startup clean for development
- API key auth uses WebSocket close code 4003 (application-specific range 4000-4999)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness
- All security hardening complete for v1.1 scope
- Phase 18 (Protocol Docs) can reference the new env vars and auth mechanism
- CORS_ORIGINS and API_KEY documented in utils.py, ready for WEBSOCKET.md

---
*Phase: 14-security-hardening*
*Completed: 2026-02-10*
