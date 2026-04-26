// Generic speech-to-text contracts used by the voice control pipeline.
//
// The renderer talks to a SpeechTranscriber implementation (e.g. the
// ElevenLabs Scribe transcriber) which is responsible for capturing audio,
// detecting utterances, and producing diarized transcripts. This file is
// transport-agnostic: it only defines types so the panel and store can stay
// decoupled from any specific STT vendor.

export interface TranscriptSegment {
  text: string
  speakerId: string | null
  startSec: number
  endSec: number
}

export interface TranscriptResult {
  text: string
  segments: TranscriptSegment[]
}

export interface SpeechTranscriberCallbacks {
  onStart?: () => void
  onEnd?: () => void
  onAudioLevel?: (_rms: number) => void
  onRecordingStart?: () => void
  onRecordingEnd?: () => void
  onTranscript: (_result: TranscriptResult) => void
  onError?: (_message: string) => void
  /** Fired when no speech activity occurs for the configured inactivity timeout. */
  onInactivityTimeout?: () => void
}

export interface SpeechTranscriber {
  start: () => Promise<void>
  stop: () => void
}
