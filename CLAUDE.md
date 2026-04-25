Read CLAUDE.md first.

Build out the Zustand stores in src/renderer/src/stores/:

1. settingsStore.ts:
   - State: sensitivity, clickDelay, selectedCamera, calibration data
   - Actions to update each
   - Persist to electron-store via a custom middleware (research how — 
     ask me before implementing if unclear)

2. gestureStore.ts:
   - State: leftHandGesture, rightHandGesture, combinedGesture
   - Actions: setLeftGesture, setRightGesture, clearGestures
   - No persistence — this is real-time state

3. statusStore.ts:
   - State: isActive, fps, errorMessage, cameraConnected
   - Actions to update each

Define proper TypeScript types in src/renderer/src/types/index.ts for:
- Hand (left/right)
- Gesture (named gestures: pinch, fist, palm, point, etc.)
- HandLandmark (matches MediaPipe's structure)
- CalibrationProfile

Exception: voice command execution may add narrow IPC in `src/main/index.ts` and `src/preload/index.ts` (`voice:executeIntent` for `search_web` / `open_app` only). Otherwise do not touch main, preload, or electron.vite.config.ts.