// Always-on wake word detector.
//
// Uses the energy-VAD audio capture (audioCapture.ts) to detect short
// utterances and ships each one to ElevenLabs Scribe for STT. If the returned
// transcript contains the wake phrase "Hey Airflow" the onWakeWord callback
// fires exactly once - the caller is responsible for stopping the detector and
// starting the full ElevenLabs transcriber.
//
// Why VAD + Scribe instead of webkitSpeechRecognition? Chromium's built-in
// speech recognition relies on a Google cloud key bundled into Chrome that
// Electron does not ship, so the API silently fails to ever return results in
// Electron renderers (verified on Electron 35).

import { createUtteranceCapture, type UtteranceCapture } from './audioCapture'

const ELEVENLABS_STT_ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text'
const SCRIBE_MODEL_ID = 'scribe_v1'

// Reject blobs that are clearly too short to contain "hey airflow", or far too
// long to be a wake phrase (probably mid-sentence speech). audioCapture's VAD
// already enforces a 300ms floor; the byte limits below are a sanity layer on
// top of that to avoid wasting Scribe calls.
const MIN_BLOB_BYTES = 1500
const MAX_BLOB_BYTES = 80_000

const WAKE_PHRASES = [
  'hey airflow',
  'hey air flow',
  'hey airflo',
  'hey erflow',
  'hey air-flow'
]

export interface WakeWordCallbacks {
  apiKey: string
  onWakeWord: () => void
  onError?: (_message: string) => void
}

function containsWakePhrase(_text: string): boolean {
  const _normalized = _text
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return WAKE_PHRASES.some((_phrase) => _normalized.includes(_phrase))
}

interface ScribeResponse {
  text?: string
}

export class WakeWordDetector {
  private readonly m_apiKey: string
  private readonly m_onWakeWord: () => void
  private readonly m_onError?: (_message: string) => void
  private m_capture: UtteranceCapture | null = null
  private m_stopped = false

  constructor(_callbacks: WakeWordCallbacks) {
    this.m_apiKey = _callbacks.apiKey
    this.m_onWakeWord = _callbacks.onWakeWord
    this.m_onError = _callbacks.onError
  }

  start(): void {
    if (!this.m_apiKey) {
      this.m_onError?.(
        'wake-word-missing-elevenlabs-api-key: set RENDERER_VITE_ELEVENLABS_API_KEY in .env.local'
      )
      return
    }
    if (this.m_capture) {
      return
    }
    this.m_stopped = false

    const _capture = createUtteranceCapture({
      onSpeechEnd: (_blob) => {
        void this.handleUtterance(_blob)
      },
      onError: (_message) => {
        this.m_onError?.(_message)
      }
      // No inactivity timeout for wake mode - we listen forever.
    })
    this.m_capture = _capture
    void _capture.start().catch((_err) => {
      this.m_capture = null
      const _message = _err instanceof Error ? _err.message : 'wake-word-start-failed'
      this.m_onError?.(_message)
    })
  }

  stop(): void {
    this.m_stopped = true
    if (this.m_capture) {
      try {
        this.m_capture.stop()
      } catch {
        // ignore - may already be torn down
      }
      this.m_capture = null
    }
  }

  private async handleUtterance(_blob: Blob): Promise<void> {
    if (this.m_stopped) {
      return
    }
    if (_blob.size < MIN_BLOB_BYTES || _blob.size > MAX_BLOB_BYTES) {
      return
    }

    try {
      const _formData = new FormData()
      _formData.append('file', _blob, 'wake.webm')
      _formData.append('model_id', SCRIBE_MODEL_ID)
      _formData.append('language_code', 'en')

      const _response = await fetch(ELEVENLABS_STT_ENDPOINT, {
        method: 'POST',
        headers: { 'xi-api-key': this.m_apiKey },
        body: _formData
      })

      if (this.m_stopped) {
        return
      }

      if (!_response.ok) {
        if (_response.status === 401 || _response.status === 403) {
          this.m_onError?.(`wake-word-elevenlabs-auth-error: ${_response.status}`)
        }
        // Transient errors (429, 5xx) are ignored - VAD keeps capturing.
        return
      }

      const _json = (await _response.json()) as ScribeResponse
      const _text = (_json.text ?? '').trim()
      const _matched = containsWakePhrase(_text)
      if (_text.length === 0) {
        return
      }
      if (_matched) {
        this.stop()
        this.m_onWakeWord()
      }
    } catch (_err) {
      // Network blip - swallow and keep listening.
      console.warn('[WakeWordDetector] STT request failed:', _err)
    }
  }
}
