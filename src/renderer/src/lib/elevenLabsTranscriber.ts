// ElevenLabs Scribe transcriber.
//
// Pairs the energy-VAD utterance capture (audioCapture.ts) with the
// ElevenLabs /v1/speech-to-text REST endpoint. Each detected utterance is
// uploaded as multipart/form-data; the response (text + per-word speaker_id
// when diarization is enabled) is grouped into TranscriptSegments and pushed
// back to the panel via the SpeechTranscriber callbacks.

import { createUtteranceCapture, type UtteranceCapture } from './audioCapture'
import type {
  SpeechTranscriber,
  SpeechTranscriberCallbacks,
  TranscriptResult,
  TranscriptSegment
} from './speechRecognition'

const ELEVENLABS_STT_ENDPOINT = 'https://api.elevenlabs.io/v1/speech-to-text'
const ELEVENLABS_ISOLATION_ENDPOINT = 'https://api.elevenlabs.io/v1/audio-isolation/stream'
const DEFAULT_MODEL_ID = 'scribe_v1'

export interface ElevenLabsTranscriberOptions {
  apiKey: string
  modelId?: string
  languageCode?: string
  diarize?: boolean
  /**
   * When true, each captured utterance is sent through ElevenLabs Audio
   * Isolation before transcription, removing background noise and
   * non-speech sounds. Adds one extra API round-trip per utterance.
   * Defaults to false.
   */
  isolateAudio?: boolean
}

interface ScribeWord {
  text?: string
  start?: number
  end?: number
  speaker_id?: string | null
  type?: string
}

interface ScribeResponse {
  text?: string
  words?: ScribeWord[]
}

function groupWordsBySpeaker(_words: ScribeWord[]): TranscriptSegment[] {
  const _segments: TranscriptSegment[] = []
  let m_currentSpeaker: string | null | undefined = undefined
  let m_currentWords: string[] = []
  let m_currentStart = 0
  let m_currentEnd = 0

  const flush = (): void => {
    if (m_currentWords.length === 0) {
      return
    }
    _segments.push({
      text: m_currentWords
        .join(' ')
        .replace(/\s+([.,!?;:])/g, '$1')
        .trim(),
      speakerId: m_currentSpeaker ?? null,
      startSec: m_currentStart,
      endSec: m_currentEnd
    })
    m_currentWords = []
  }

  for (const _word of _words) {
    if (_word.type === 'spacing' || !_word.text) {
      continue
    }
    const _speaker = _word.speaker_id ?? null
    if (m_currentSpeaker === undefined) {
      m_currentSpeaker = _speaker
      m_currentStart = _word.start ?? 0
    } else if (_speaker !== m_currentSpeaker) {
      flush()
      m_currentSpeaker = _speaker
      m_currentStart = _word.start ?? 0
    }
    m_currentWords.push(_word.text)
    m_currentEnd = _word.end ?? m_currentEnd
  }
  flush()
  return _segments
}

function buildResultFromResponse(_response: ScribeResponse): TranscriptResult {
  const _segments = groupWordsBySpeaker(_response.words ?? [])
  const _text = (_response.text ?? _segments.map((_s) => _s.text).join(' ')).trim()
  return { text: _text, segments: _segments }
}

function describeHttpError(_status: number): string {
  if (_status === 401) {
    return 'elevenlabs-unauthorized: check RENDERER_VITE_ELEVENLABS_API_KEY'
  }
  if (_status === 403) {
    return 'elevenlabs-forbidden: API key lacks Scribe access'
  }
  if (_status === 413) {
    return 'elevenlabs-payload-too-large: utterance exceeded size limit'
  }
  if (_status === 429) {
    return 'elevenlabs-rate-limited: slow down or upgrade plan'
  }
  if (_status >= 500) {
    return `elevenlabs-server-error: ${_status}`
  }
  return `elevenlabs-request-failed: ${_status}`
}

export class ElevenLabsScribeTranscriber implements SpeechTranscriber {
  private readonly m_apiKey: string
  private readonly m_modelId: string
  private readonly m_languageCode: string | undefined
  private readonly m_diarize: boolean
  private readonly m_isolateAudio: boolean
  private readonly m_callbacks: SpeechTranscriberCallbacks
  private m_capture: UtteranceCapture | null = null
  private m_inflightRequests = 0
  private m_isStarted = false

  constructor(_options: ElevenLabsTranscriberOptions, _callbacks: SpeechTranscriberCallbacks) {
    if (!_options.apiKey) {
      throw new Error('missing-elevenlabs-api-key')
    }
    this.m_apiKey = _options.apiKey
    this.m_modelId = _options.modelId ?? DEFAULT_MODEL_ID
    this.m_languageCode = _options.languageCode
    this.m_diarize = _options.diarize ?? true
    this.m_isolateAudio = _options.isolateAudio ?? false
    this.m_callbacks = _callbacks
  }

  async start(): Promise<void> {
    if (this.m_isStarted) {
      return
    }
    const _capture = createUtteranceCapture({
      onAudioLevel: (_rms) => this.m_callbacks.onAudioLevel?.(_rms),
      onSpeechStart: () => this.m_callbacks.onRecordingStart?.(),
      onSpeechEnd: (_blob) => {
        this.m_callbacks.onRecordingEnd?.()
        void this.transcribeUtterance(_blob)
      },
      onError: (_message) => this.m_callbacks.onError?.(_message)
    })
    this.m_capture = _capture
    try {
      await _capture.start()
      this.m_isStarted = true
      this.m_callbacks.onStart?.()
    } catch (_error) {
      this.m_capture = null
      throw _error
    }
  }

  stop(): void {
    if (!this.m_isStarted) {
      return
    }
    this.m_isStarted = false
    this.m_capture?.stop()
    this.m_capture = null
    this.m_callbacks.onEnd?.()
  }

  private async transcribeUtterance(_audio: Blob): Promise<void> {
    this.m_inflightRequests++
    try {
      const _audioToTranscribe = this.m_isolateAudio
        ? await this.denoiseAudio(_audio)
        : _audio

      const _formData = new FormData()
      _formData.append('file', _audioToTranscribe, 'utterance.webm')
      _formData.append('model_id', this.m_modelId)
      if (this.m_languageCode) {
        _formData.append('language_code', this.m_languageCode)
      }
      if (this.m_diarize) {
        _formData.append('diarize', 'true')
      }

      const _response = await fetch(ELEVENLABS_STT_ENDPOINT, {
        method: 'POST',
        headers: {
          'xi-api-key': this.m_apiKey
        },
        body: _formData
      })

      if (!_response.ok) {
        this.m_callbacks.onError?.(describeHttpError(_response.status))
        return
      }

      const _json = (await _response.json()) as ScribeResponse
      const _result = buildResultFromResponse(_json)
      if (_result.text.length === 0) {
        return
      }
      this.m_callbacks.onTranscript(_result)
    } catch (_error) {
      const _message = _error instanceof Error ? _error.message : 'transcription-request-failed'
      this.m_callbacks.onError?.(_message)
    } finally {
      this.m_inflightRequests--
    }
  }

  /**
   * Sends an audio blob through the ElevenLabs Audio Isolation API to strip
   * background noise. Returns the cleaned audio blob. If the request fails,
   * logs a warning and returns the original blob so transcription still works.
   */
  private async denoiseAudio(_audio: Blob): Promise<Blob> {
    try {
      const _form = new FormData()
      _form.append('audio', _audio, 'utterance.webm')

      const _response = await fetch(ELEVENLABS_ISOLATION_ENDPOINT, {
        method: 'POST',
        headers: { 'xi-api-key': this.m_apiKey },
        body: _form
      })

      if (!_response.ok) {
        console.warn(
          `[ElevenLabs] audio isolation failed (${_response.status}) — using original audio`
        )
        return _audio
      }

      const _cleanedBuffer = await _response.arrayBuffer()
      if (_cleanedBuffer.byteLength === 0) {
        return _audio
      }
      return new Blob([_cleanedBuffer], { type: 'audio/mpeg' })
    } catch (_err) {
      console.warn('[ElevenLabs] audio isolation request threw — using original audio:', _err)
      return _audio
    }
  }
}
