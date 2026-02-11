# Codebase Concerns

**Analysis Date:** 2026-02-10

## Tech Debt

**Hardcoded Unix paths on Windows platform:**
- Issue: `/tmp/` paths hardcoded for debug logging
- Files: `backend/app/routers/conversation.py` (line 374), `backend/app/services/hume_tone.py` (line 52)
- Why: Quick debug logging during development
- Impact: File operations fail on Windows, breaking debug logging
- Fix approach: Replace with `tempfile.gettempdir()` or `pathlib.Path`

**Broad exception handling:**
- Issue: Catch-all `except Exception` without specific exception types
- Files: `backend/app/routers/conversation.py` (lines 83, 87, 233, 365, 387, 518, 522), `backend/app/services/hume_tone.py` (lines 172, 180), `ml/ws_server.py` (lines 68, 185, 270)
- Why: Rapid development, defensive coding
- Impact: Masks unexpected errors, makes debugging difficult
- Fix approach: Catch specific exceptions per operation, re-raise unexpected ones

**In-memory profile storage:**
- Issue: Profiles stored in dict, lost on restart (`_profiles = {}`)
- File: `backend/app/routers/profile.py` (line 13)
- Why: MVP simplicity
- Impact: All user accessibility settings lost on server restart
- Fix approach: Add persistent storage (SQLite, JSON file, or database)

**Inconsistent logging (print vs logging):**
- Issue: Backend uses `print()`, ML uses proper `logging` module
- Files: `backend/app/routers/conversation.py` (many lines), vs `ml/ws_server.py` (uses `logger`)
- Why: Different development phases/authors
- Impact: Can't control log levels in production, no structured logging in backend
- Fix approach: Migrate backend `print()` to Python `logging` module

**Large monolithic files:**
- Issue: Single files with complex intertwined logic
- Files: `backend/app/routers/conversation.py` (527 lines), `senseai-frontend/src/components/LiveWorkspace.tsx` (612 lines)
- Why: Organic growth during feature development
- Impact: Hard to test individual functions, high cognitive load, increased bug risk
- Fix approach: Extract WebSocket message handlers, room management, and TTS streaming into separate modules

## Known Bugs

**No confirmed bugs found during static analysis.**

Codebase appears functionally stable (all 131+ ML tests pass, v1.1 shipped).

## Security Considerations

**CORS wildcard default:**
- Risk: Without `FRONTEND_ORIGIN` env var, accepts requests from any origin (`["*"]`)
- File: `backend/app/main.py` (lines 32-41)
- Current mitigation: Configurable via environment variable
- Recommendations: Document that production must set `FRONTEND_ORIGIN`; fail-safe to restrictive default

**Missing input validation on profiles:**
- Risk: No constraints on `profile_type` (accepts any string) or `user_name` (unbounded length)
- Files: `backend/app/models/schemas.py` (lines 7-9), `backend/app/routers/profile.py` (line 45)
- Current mitigation: Silent fallback to "deaf" profile type
- Recommendations: Add `Field(pattern="^(deaf|blind|deafblind|mute)$")` and `max_length` constraints

**No rate limiting on API calls:**
- Risk: Unlimited calls to expensive external APIs (Groq, Hume, ElevenLabs) per WebSocket connection
- Files: `backend/app/services/claude_intelligence.py`, `backend/app/services/hume_tone.py`, `backend/app/services/elevenlabs_tts.py`
- Current mitigation: None
- Recommendations: Add per-connection rate limiting and per-endpoint quotas

**Missing WebSocket message validation:**
- Risk: JSON messages not validated against schema, defaults to empty strings
- Files: `backend/app/routers/conversation.py` (lines 179-188), `ml/ws_server.py` (lines 162-170)
- Current mitigation: Silent fallback for unknown message types
- Recommendations: Use Pydantic models for WebSocket message validation

**No text length limits on braille endpoint:**
- Risk: Arbitrarily large text accepted, potential memory exhaustion
- File: `backend/app/routers/braille.py` (lines 14-39)
- Current mitigation: None
- Recommendations: Add `max_length` constraint to `text` query parameter

## Performance Bottlenecks

**Conversation history truncation:**
- Problem: History truncated at 2000 chars, dropping to 1500 without warning
- File: `backend/app/routers/conversation.py` (lines 215-216, 338-339, 490-492)
- Cause: No pagination or summarization of older context
- Improvement path: Summarize older history before truncating; log when truncation occurs

**No performance bottlenecks measured** - real-time WebSocket latency appears acceptable for current scale.

## Fragile Areas

**Tone mapping emotion labels:**
- Why fragile: Hardcoded Hume emotion names in switching logic
- File: `backend/app/services/hume_tone.py` (lines 114-126)
- Common failures: If Hume API changes emotion labels, code breaks silently
- Safe modification: Extract emotion classification to configurable mapping
- Test coverage: No unit tests for tone mapping logic

**Temp file cleanup in Hume service:**
- Why fragile: `temp_path` may not be assigned before `finally` block runs
- File: `backend/app/services/hume_tone.py` (lines 69-163)
- Common failures: `NameError` if exception before temp file creation
- Safe modification: Initialize `temp_path = None` before try block
- Test coverage: No tests for error paths

**WebSocket cleanup on disconnect:**
- Why fragile: Cleanup assumes `prosody_buffer` was initialized; no timeout on `stop()`
- File: `backend/app/routers/conversation.py` (lines 524-527), `ml/ws_server.py` (lines 272-274)
- Common failures: Crash if exception during WebSocket startup phase
- Safe modification: Add guard clauses; ensure stop operations have timeouts

## Dependencies at Risk

**websockets version mismatch:**
- Risk: `websockets==16.0` (ML) vs `websockets==13.1` (Backend) - major version difference
- Impact: Different WebSocket behavior between services
- Migration plan: Align on same major version when next updating

**FastAPI minor version mismatch:**
- Risk: `fastapi==0.128.6` (ML) vs `fastapi==0.128.5` (Backend)
- Impact: Low risk (patch version), but should align
- Migration plan: Pin both to same version

**OpenAI SDK unbounded:**
- Risk: `openai>=1.0.0` has no upper bound
- File: `backend/requirements.txt`
- Impact: Major version bump could break API calls
- Migration plan: Add upper bound (`openai>=1.0.0,<3.0.0`)

**MediaPipe 0.10.21 pinned (intentional):**
- Risk: Frozen at last version with `mp.solutions.holistic`
- Impact: No security/bug fixes from upstream
- Migration plan: None needed unless holistic alternative found in newer MediaPipe

## Missing Critical Features

**No persistent storage:**
- Problem: All state (profiles, conversations) lives in memory
- Current workaround: Users re-create profile each session
- Blocks: Multi-session history, user preferences persistence
- Implementation complexity: Low (add SQLite or JSON file storage)

**No authentication system:**
- Problem: No user identity, anyone can access any endpoint
- Current workaround: Single-user/demo mode assumed
- Blocks: Multi-user deployment, personalized experiences
- Implementation complexity: Medium (add JWT or session-based auth)

## Test Coverage Gaps

**Backend services untested:**
- What's not tested: `backend/app/services/*.py` (10 service modules), `backend/app/routers/conversation.py` (527-line WebSocket handler)
- Risk: Breaking changes to conversation logic, tone analysis, TTS streaming undetected
- Priority: High
- Difficulty to test: Need to mock external APIs (Groq, Hume, ElevenLabs)

**Frontend completely untested:**
- What's not tested: All React components, hooks, and utilities in `senseai-frontend/`
- Risk: UI regressions, WebSocket reconnection failures, accessibility feature breakage
- Priority: Medium
- Difficulty to test: Need React Testing Library or Playwright setup

**Missing .env.example for ML module:**
- What's missing: ML environment variables documented only in code
- File: `ml/utils.py` (lines 78-91) defines HOST, PORT, CORS_ORIGINS, API_KEY
- Backend has: `backend/.env.example`
- Priority: Low
- Fix: Create `ml/.env.example`

---

*Concerns audit: 2026-02-10*
*Update as issues are fixed or new ones discovered*
