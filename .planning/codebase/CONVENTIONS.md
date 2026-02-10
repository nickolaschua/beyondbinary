# Coding Conventions

**Analysis Date:** 2026-02-10

## Naming Patterns

**Files:**
- `snake_case.py` for all Python modules (`groq_stt.py`, `tone_aggregator.py`, `braille_ueb.py`)
- `PascalCase.tsx` for React components (`LiveWorkspace.tsx`, `BrailleCell.tsx`, `AccessibilityBoot.tsx`)
- `camelCase.ts` for hooks (`useWebSocket.ts`, `useVoiceCommands.ts`) and utilities (`api.ts`, `constants.ts`)
- `test_*.py` for Python test files (`test_augment.py`, `test_smoke.py`)
- `UPPERCASE.md` for important docs (`README.md`, `WEBSOCKET.md`)

**Functions:**
- Python: `snake_case` (`extract_keypoints()`, `text_to_speech_bytes()`, `analyze_text_sentiment()`)
- TypeScript: `camelCase` (`checkBackendHealth()`, `postTts()`, `disconnect()`)
- No special prefix for async functions in either language
- React handlers: not standardized yet

**Variables:**
- Python: `snake_case` for variables, `UPPER_SNAKE_CASE` for constants
  - Constants: `CONFIDENCE_THRESHOLD = 0.7`, `STABILITY_WINDOW = 8`, `ACTIONS`, `SEQUENCE_LENGTH`
  - Private: Leading underscore (`_samples`, `_LETTER_MAP`, `_ensure_mediapipe_solutions()`)
- TypeScript: `camelCase` for variables, `UPPER_CASE` for constants
  - Constants: `API_URL`, `WS_URL`, `DEFAULT_CELLS_PER_LINE`

**Types:**
- Python classes: PascalCase (`ToneAggregator`, `StabilityFilter`, `ToneSample`)
- TypeScript interfaces: PascalCase, no I prefix (`BrailleCellPattern`, `UseWebSocketOptions`, `ProfileChannels`)
- Pydantic models: PascalCase (`ProfileCreate`, `TTSRequest`, `ProfileResponse`)

## Code Style

**Formatting:**
- Python: 4-space indentation, PEP 8 style (no explicit formatter config)
- TypeScript: 2-space indentation (Next.js convention)
- Python strings: Mix of single and double quotes (no enforced preference)
- TypeScript strings: Double quotes
- Semicolons: Required in TypeScript, N/A in Python

**Linting:**
- TypeScript: ESLint 9 flat config (`senseai-frontend/eslint.config.mjs`)
  - Uses `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
  - Global ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`
- Python: No explicit linter config (no .pylintrc, .flake8, pyproject.toml linting section)
- No Prettier config detected for either language

## Import Organization

**Python:**
- Standard library first, then third-party, then local
- No enforced import sorting tool
- Examples from `backend/app/services/tone_aggregator.py`:
  - `from dataclasses import dataclass`
  - `from typing import Optional, List`
  - Local imports as needed

**TypeScript:**
- External packages first (react, next)
- Internal modules via `@/` alias
- Relative imports last
- Path alias: `@/` maps to `src/` (`senseai-frontend/tsconfig.json`)

## Error Handling

**Patterns:**
- Backend services: try/catch with graceful degradation on API failure
- Hume tone falls back to AFINN text sentiment
- Services return None on failure, callers check before proceeding
- Broad `except Exception` used frequently (noted as tech debt)

**Error Types:**
- Python: Standard exceptions, no custom exception classes
- Services log errors and return fallback values rather than propagating
- WebSocket: Errors logged, connection cleaned up in finally blocks

## Logging

**Framework:**
- ML service: Python `logging` module (`ml/ws_server.py`)
- Backend: `print()` statements (inconsistent, should migrate to logging)
- Frontend: `console.log` / `console.error`

**Patterns:**
- ML uses structured logging with logger instance
- Backend uses print for status messages and debug output
- No centralized logging configuration

## Comments

**When to Comment:**
- Module-level docstrings present in most Python files
  - Example: `"""SenseAI Backend — FastAPI Application Entry Point."""` (`backend/app/main.py`)
- Function docstrings: Google-style with Args/Returns in well-documented services
  - Example: `backend/app/services/tone_aggregator.py` - detailed parameter descriptions
- Inline comments explain "why" not "what"
- Section boundary comments in test files

**JSDoc/TSDoc:**
- TypeScript interfaces have inline comments
- Strict mode enabled (`"strict": true` in `senseai-frontend/tsconfig.json`)
- Not heavily documented with JSDoc

**TODO Comments:**
- Format: `# TODO: description` (Python)
- No consistent tracking convention (no issue numbers)

## Function Design

**Size:**
- Most service functions are focused (30-80 lines)
- Notable exceptions: `conversation.py` WebSocket handler (527 lines), `LiveWorkspace.tsx` (612 lines)

**Parameters:**
- Python: Type hints required for public functions
  - Enforced by tests: `ml/tests/test_utils_types.py` verifies all public functions have annotations
  - Example: `def add_sample(self, sample: ToneSample) -> None:`
- TypeScript: Full type annotations with strict mode

**Return Values:**
- Python services: Return Optional values (None on failure)
- TypeScript: Explicit return types

## Module Design

**Exports:**
- Python: No barrel files, direct imports from modules
- TypeScript: Named exports preferred
- React components: Default exports for page components, named for shared components

**Dataclasses:**
- Used for structured data in Python (`@dataclass` for `ToneSample`)
- Pydantic `BaseModel` for API schemas

---

*Convention analysis: 2026-02-10*
*Update when patterns change*
