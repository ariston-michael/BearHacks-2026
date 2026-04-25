// Zustand store holding the current per-hand detection (landmarks + classified
// gesture + confidence) and the combined gesture intent. Updated every frame
// by the gesture pipeline; consumed by UI components and the action dispatcher.
// No persistence — this is real-time state.

import { create } from 'zustand'
import type { DetectedHand, GestureName } from '../types'

interface GestureState {
  leftHand: DetectedHand | null
  rightHand: DetectedHand | null
  combinedGesture: GestureName | null
  setLeftHand: (_hand: DetectedHand | null) => void
  setRightHand: (_hand: DetectedHand | null) => void
  setCombinedGesture: (_gesture: GestureName | null) => void
  clearHands: () => void
}

export const useGestureStore = create<GestureState>((_set) => ({
  leftHand: null,
  rightHand: null,
  combinedGesture: null,
  setLeftHand: (_hand) => _set({ leftHand: _hand }),
  setRightHand: (_hand) => _set({ rightHand: _hand }),
  setCombinedGesture: (_gesture) => _set({ combinedGesture: _gesture }),
  clearHands: () => _set({ leftHand: null, rightHand: null, combinedGesture: null })
}))
