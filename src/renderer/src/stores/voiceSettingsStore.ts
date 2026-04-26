// Zustand store for ElevenLabs TTS voice settings.
// Persisted to localStorage via the zustand persist middleware so preferences
// survive page reloads. The availableVoices list is runtime-only (not stored).

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ElevenLabsVoice } from '../lib/elevenLabsTts'

export const ELEVENLABS_MODELS = [
  { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5 (low latency)' },
  { id: 'eleven_flash_v2_5', label: 'Flash v2.5 (fastest)' },
  { id: 'eleven_multilingual_v2', label: 'Multilingual v2 (most capable)' },
  { id: 'eleven_turbo_v2', label: 'Turbo v2' },
  { id: 'eleven_monolingual_v1', label: 'Monolingual v1 (English)' }
] as const

interface VoiceSettingsState {
  voiceId: string
  modelId: string
  stability: number
  similarityBoost: number
  style: number
  useSpeakerBoost: boolean
  speed: number
  acknowledgementsEnabled: boolean
  availableVoices: ElevenLabsVoice[]
  setVoiceId: (_value: string) => void
  setModelId: (_value: string) => void
  setStability: (_value: number) => void
  setSimilarityBoost: (_value: number) => void
  setStyle: (_value: number) => void
  setUseSpeakerBoost: (_value: boolean) => void
  setSpeed: (_value: number) => void
  setAcknowledgementsEnabled: (_value: boolean) => void
  setAvailableVoices: (_voices: ElevenLabsVoice[]) => void
}

export const useVoiceSettingsStore = create<VoiceSettingsState>()(
  persist(
    (_set) => ({
      voiceId: '21m00Tcm4TlvDq8ikWAM',
      modelId: 'eleven_turbo_v2_5',
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0,
      useSpeakerBoost: true,
      speed: 1.0,
      acknowledgementsEnabled: true,
      availableVoices: [],
      setVoiceId: (_value) => _set({ voiceId: _value }),
      setModelId: (_value) => _set({ modelId: _value }),
      setStability: (_value) => _set({ stability: _value }),
      setSimilarityBoost: (_value) => _set({ similarityBoost: _value }),
      setStyle: (_value) => _set({ style: _value }),
      setUseSpeakerBoost: (_value) => _set({ useSpeakerBoost: _value }),
      setSpeed: (_value) => _set({ speed: _value }),
      setAcknowledgementsEnabled: (_value) => _set({ acknowledgementsEnabled: _value }),
      setAvailableVoices: (_voices) => _set({ availableVoices: _voices })
    }),
    {
      name: 'aircontrol-voice-settings',
      partialize: (_state) => ({
        voiceId: _state.voiceId,
        modelId: _state.modelId,
        stability: _state.stability,
        similarityBoost: _state.similarityBoost,
        style: _state.style,
        useSpeakerBoost: _state.useSpeakerBoost,
        speed: _state.speed,
        acknowledgementsEnabled: _state.acknowledgementsEnabled
      })
    }
  )
)
