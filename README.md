# AirControl

AirControl is a desktop app that replaces the mouse and keyboard with two-handed gesture control. The right hand moves the cursor (pinch to click, palm to scroll), the left hand acts as a modifier key analogous to Shift or Cmd, and combined gestures trigger keyboard shortcuts like Cmd-Tab, copy/paste, and desktop switching. Standalone shape gestures (C-shape, V-sign, OK sign) trigger common actions. Everything runs fully locally with no cloud dependency.

## Prerequisites

- Node.js 22+
- macOS Tahoe, Windows 11, or Ubuntu 22.04+
- A webcam

## Setup

```bash
git clone <repo-url>
cd air-control
npm install
npm run dev
```

## macOS Permissions

On first launch macOS will prompt for two permissions:

| Permission | Where to grant |
|---|---|
| Camera | System Settings → Privacy & Security → Camera → AirControl |
| Accessibility (for mouse/keyboard control) | System Settings → Privacy & Security → Accessibility → AirControl |

If the prompts don't appear, add AirControl manually in each section above.

## Tech Stack

- Electron + electron-vite
- React 19 + TypeScript
- MediaPipe Hands (hand landmark detection)
- nut-js (system cursor + keyboard automation)
- Zustand (state management)
- Tailwind CSS (styling)
- electron-store (settings persistence)

## Team Ownership

| Person | Owns |
|---|---|
| Person A | `src/renderer/src/lib/handDetection.ts`, `handAssignment.ts`, `gestureClassifier.ts` |
| Person B | `src/renderer/src/lib/gestureCombinator.ts`, `actionDispatcher.ts`, `cursorMapper.ts`, `smoothing.ts` |
| Person C | `src/renderer/src/pages/`, `src/renderer/src/components/`, `App.tsx` |
| Person D | `src/renderer/src/stores/`, `src/renderer/src/lib/calibration.ts`, `pages/CalibrationPage.tsx`, `pages/SettingsPage.tsx` |

## Branch Workflow

```
main            — stable, demo-ready
develop         — integration branch; all features merge here first
feature/<name>  — one branch per feature/person (e.g. feature/gesture-classifier)
```

PRs go from `feature/*` → `develop`. Merge `develop` → `main` only for demo checkpoints.
