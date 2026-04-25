// Zustand store holding the current per-hand classified gesture and the combined intent.
// Updated every frame by the gesture pipeline; consumed by UI components and the action dispatcher.

import { create } from 'zustand'

interface GestureState {
  rightGesture: string | null
  leftGesture: string | null
  combinedIntent: string | null
  setRightGesture: (g: string | null) => void
  setLeftGesture: (g: string | null) => void
  setCombinedIntent: (i: string | null) => void
}

export const useGestureStore = create<GestureState>((set) => ({
  rightGesture: null,
  leftGesture: null,
  combinedIntent: null,
  setRightGesture: (g) => set({ rightGesture: g }),
  setLeftGesture: (g) => set({ leftGesture: g }),
  setCombinedIntent: (i) => set({ combinedIntent: i }),
}))
