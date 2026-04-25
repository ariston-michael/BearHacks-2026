import { create } from 'zustand'

type VoiceIntentAction =
  | 'open_app'
  | 'search_web'
  | 'scroll_up'
  | 'scroll_down'
  | 'click'
  | 'unknown'

export interface VoiceIntent {
  action: VoiceIntentAction
  query?: string
  appName?: string
  confidence: number
  raw: string
}

interface VoiceState {
  isListening: boolean
  transcript: string
  lastIntent: VoiceIntent | null
  errorMessage: string | null
  setIsListening: (_value: boolean) => void
  setTranscript: (_value: string) => void
  setLastIntent: (_value: VoiceIntent | null) => void
  setErrorMessage: (_value: string | null) => void
  clearVoiceState: () => void
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isListening: false,
  transcript: '',
  lastIntent: null,
  errorMessage: null,
  setIsListening: (_value) => set({ isListening: _value }),
  setTranscript: (_value) => set({ transcript: _value }),
  setLastIntent: (_value) => set({ lastIntent: _value }),
  setErrorMessage: (_value) => set({ errorMessage: _value }),
  clearVoiceState: () =>
    set({
      transcript: '',
      lastIntent: null,
      errorMessage: null
    })
}))
