# Merge: braile + frontend_harsh (selective)

**Goal:** Keep braille output and blind/deafblind workspace from **braile**, and add backend + connection + HTTPS/SSL from **frontend_harsh**.

## Strategy

- **Base branch:** `braile` (current). It has braille UI, blind/deafblind workspace, and `BrailleCell` / `braille/mapping.ts`.
- **Bring in from `origin/frontend_harsh`** only files that are backend-related, connection-related, or HTTPS/SSL-related.
- **Do not overwrite** any frontend files that implement braille or blind/deafblind workspace.

## Files taken FROM frontend_harsh

| Path | Reason |
|------|--------|
| `backend/README.md` | Backend docs |
| `backend/app/main.py` | Backend entry (CORS/origins) |
| `backend/app/routers/conversation.py` | Backend conversation/connection |
| `backend/app/routers/tts.py` | Backend TTS |
| `backend/app/services/elevenlabs_tts.py` | Backend TTS service |
| `backend/run_https.sh` | **HTTPS** backend launcher (frontend_harsh only) |
| `senseai-frontend/server.js` | **HTTPS** dev server with certs + LAN (frontend_harsh has full version) |
| `senseai-frontend/scripts/ssl-with-lan.sh` | **SSL** script (frontend_harsh only) |
| `senseai-frontend/next.config.ts` | May include SSL/connection config |
| `senseai-frontend/package.json` | Scripts for `server.js` / SSL if needed |
| `senseai-frontend/README.md` | HTTPS/connection instructions |

## Files kept FROM braile (not overwritten)

| Path | Reason |
|------|--------|
| `senseai-frontend/src/braille/mapping.ts` | Braille character mapping |
| `senseai-frontend/src/components/LiveWorkspace.tsx` | Braille output + blind/deafblind workspace UI |
| `senseai-frontend/src/components/BrailleCell.tsx` | Braille display component |
| `senseai-frontend/src/app/onboarding/page.tsx` | Braille preview for blind/deafblind |
| `senseai-frontend/src/app/layout.tsx` | Layout (keep braile to avoid breaking a11y) |
| `senseai-frontend/src/app/globals.css` | Styles (braile may have braille-specific) |
| `senseai-frontend/src/app/start/page.tsx` | Start flow |
| `senseai-frontend/src/components/VideoCall.tsx` | Tied to LiveWorkspace; keep braile |
| `senseai-frontend/src/hooks/useWebRTC.ts` | Keep braile to avoid breaking LiveWorkspace |
| `senseai-frontend/src/hooks/useWebSocket.ts` | Keep braile |
| `senseai-frontend/src/components/AudioAssistButton.tsx` | A11y; keep braile |
| `senseai-frontend/src/hooks/usePageAudioGuide.ts` | A11y; keep braile |
| `senseai-frontend/src/lib/tts.ts` | Keep braile |
| `senseai-frontend/src/lib/accessibility.ts` | Keep braile |

## Optional: connection hooks from frontend_harsh

If you need connection/WebRTC improvements from frontend_harsh later, you can try bringing in only:

- `senseai-frontend/src/hooks/useWebRTC.ts`
- `senseai-frontend/src/hooks/useWebSocket.ts`

Test thoroughly after; they may change behavior.

## How to apply (already done if you ran the script)

From repo root on branch `braile`:

```bash
# Backend + HTTPS backend
git checkout origin/frontend_harsh -- \
  backend/README.md \
  backend/app/main.py \
  backend/app/routers/conversation.py \
  backend/app/routers/tts.py \
  backend/app/services/elevenlabs_tts.py \
  backend/run_https.sh

# Frontend: HTTPS server + SSL script only (no React/src changes)
git checkout origin/frontend_harsh -- \
  senseai-frontend/server.js \
  senseai-frontend/scripts/ssl-with-lan.sh \
  senseai-frontend/next.config.ts \
  senseai-frontend/package.json \
  senseai-frontend/README.md
```

Then commit and (optional) add the docs from frontend_harsh:

```bash
git checkout origin/frontend_harsh -- \
  NETWORK_SETUP.md \
  QUICK_FIX.md
```
