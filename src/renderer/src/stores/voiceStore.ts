// Zustand store for the voice/STT pipeline. Tracks listening lifecycle,
// per-utterance recording state, live audio level, the rolling transcript,
// the most recent diarized segments, the latest parsed intent, and any error
// surfaced by the transcriber or intent provider. No persistence — this is
// real-time runtime state.

import { create } from 'zustand'
import type { TranscriptSegment } from '../lib/speechRecognition'
import type { SpotifyTargetKind } from '../../../shared/voiceIpc'

export type VoiceIntentAction =
  | 'open_app'
  | 'open_url'
  | 'open_app_with_query'
  | 'search_web'
  | 'select_link'
  | 'page_question'
  | 'spotify_search'
  | 'spotify_select'
  | 'scroll_up'
  | 'scroll_down'
  | 'click'
  | 'unknown'

export interface VoiceIntent {
  action: VoiceIntentAction
  query?: string
  appName?: string
  /** Absolute URL (used by `open_url`). */
  url?: string
  /** 1-based visible link/result index for follow-up selection commands. */
  linkIndex?: number
  /** Spoken text identifying a visible link. */
  linkText?: string
  /** Phrase to locate inside current page text before answering. */
  anchorText?: string
  /** 1-based visible Spotify result index for follow-up selection commands. */
  targetIndex?: number
  /** Spoken text identifying a Spotify song/album/podcast/etc. */
  targetText?: string
  targetKind?: SpotifyTargetKind
  confidence: number
  raw: string
}

export interface VoiceActionResult {
  ok: boolean
  message: string
}

interface VoiceState {
  isListening: boolean
  isRecording: boolean
  audioLevel: number
  transcript: string
  lastSegments: TranscriptSegment[]
  lastIntent: VoiceIntent | null
  lastActionResult: VoiceActionResult | null
  errorMessage: string | null
  setIsListening: (_value: boolean) => void
  setIsRecording: (_value: boolean) => void
  setAudioLevel: (_value: number) => void
  setTranscript: (_value: string) => void
  setLastSegments: (_value: TranscriptSegment[]) => void
  setLastIntent: (_value: VoiceIntent | null) => void
  setLastActionResult: (_value: VoiceActionResult | null) => void
  setErrorMessage: (_value: string | null) => void
  appendTranscript: (_text: string, _segments: TranscriptSegment[]) => void
  clearVoiceState: () => void
}

export const useVoiceStore = create<VoiceState>((_set) => ({
  isListening: false,
  isRecording: false,
  audioLevel: 0,
  transcript: '',
  lastSegments: [],
  lastIntent: null,
  lastActionResult: null,
  errorMessage: null,
  setIsListening: (_value) => _set({ isListening: _value }),
  setIsRecording: (_value) => _set({ isRecording: _value }),
  setAudioLevel: (_value) => _set({ audioLevel: _value }),
  setTranscript: (_value) => _set({ transcript: _value }),
  setLastSegments: (_value) => _set({ lastSegments: _value }),
  setLastIntent: (_value) => _set({ lastIntent: _value }),
  setLastActionResult: (_value) => _set({ lastActionResult: _value }),
  setErrorMessage: (_value) => _set({ errorMessage: _value }),
  appendTranscript: (_text, _segments) =>
    _set((_state) => ({
      transcript: _state.transcript ? `${_state.transcript} ${_text}`.trim() : _text,
      lastSegments: _segments
    })),
  clearVoiceState: () =>
    _set({
      transcript: '',
      lastSegments: [],
      lastIntent: null,
      lastActionResult: null,
      errorMessage: null,
      audioLevel: 0,
      isRecording: false
    })
}))
