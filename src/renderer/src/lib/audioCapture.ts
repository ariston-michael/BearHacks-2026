// Energy-VAD-driven utterance capture.
//
// Opens the microphone, runs an AnalyserNode-based RMS voice-activity
// detector, and records each detected utterance with MediaRecorder. When the
// user finishes speaking (RMS stays below the silence threshold for
// SILENCE_HANG_MS), the recorded Blob is handed back via onSpeechEnd so the
// transcriber can ship it off to whichever STT vendor is configured.

const RMS_SPEECH_THRESHOLD = 0.025
const RMS_SILENCE_THRESHOLD = 0.015
const SILENCE_HANG_MS = 600
const MIN_UTTERANCE_MS = 300
const SAMPLE_INTERVAL_MS = 50
const SPEECH_START_CONSECUTIVE_TICKS = 2

export interface UtteranceCaptureCallbacks {
  onSpeechStart?: () => void
  onSpeechEnd?: (_audio: Blob) => void
  onAudioLevel?: (_rms: number) => void
  onError?: (_message: string) => void
  /** Fired when no speech starts for `inactivityTimeoutMs` after the session begins or the last utterance ends. */
  onInactivityTimeout?: () => void
}

export interface UtteranceCaptureOptions {
  /** How long to wait (ms) with no voice activity before firing onInactivityTimeout. Default: 3000. */
  inactivityTimeoutMs?: number
}

export interface UtteranceCapture {
  start: () => Promise<void>
  stop: () => void
}

type VadState = 'idle' | 'speaking'

function pickSupportedMimeType(): string {
  const _candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
  for (const _candidate of _candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(_candidate)) {
      return _candidate
    }
  }
  return ''
}

function computeRms(_buffer: Float32Array): number {
  let _sumSquares = 0
  for (let _i = 0; _i < _buffer.length; _i++) {
    const _sample = _buffer[_i]
    _sumSquares += _sample * _sample
  }
  return Math.sqrt(_sumSquares / _buffer.length)
}

export function createUtteranceCapture(
  _callbacks: UtteranceCaptureCallbacks,
  _options?: UtteranceCaptureOptions
): UtteranceCapture {
  let m_mediaStream: MediaStream | null = null
  let m_audioContext: AudioContext | null = null
  let m_analyser: AnalyserNode | null = null
  let m_sourceNode: MediaStreamAudioSourceNode | null = null
  let m_mediaRecorder: MediaRecorder | null = null
  let m_sampleTimer: ReturnType<typeof setInterval> | null = null
  let m_silenceTimer: ReturnType<typeof setTimeout> | null = null
  let m_inactivityTimer: ReturnType<typeof setTimeout> | null = null
  let m_vadState: VadState = 'idle'
  let m_consecutiveSpeechTicks = 0
  let m_recordingStartedAt = 0
  let m_recordedChunks: Blob[] = []
  let m_mimeType = ''

  const m_inactivityTimeoutMs = _options?.inactivityTimeoutMs ?? 3000

  const reportError = (_message: string): void => {
    _callbacks.onError?.(_message)
  }

  const startInactivityTimer = (): void => {
    if (m_inactivityTimer) {
      clearTimeout(m_inactivityTimer)
    }
    m_inactivityTimer = setTimeout(() => {
      m_inactivityTimer = null
      _callbacks.onInactivityTimeout?.()
    }, m_inactivityTimeoutMs)
  }

  const cancelInactivityTimer = (): void => {
    if (m_inactivityTimer) {
      clearTimeout(m_inactivityTimer)
      m_inactivityTimer = null
    }
  }

  const stopRecorderAndEmit = (): void => {
    if (!m_mediaRecorder || m_mediaRecorder.state === 'inactive') {
      m_vadState = 'idle'
      return
    }
    const _durationMs = Date.now() - m_recordingStartedAt
    const _onStop = (): void => {
      m_mediaRecorder?.removeEventListener('stop', _onStop)
      const _blob = new Blob(m_recordedChunks, { type: m_mimeType || 'audio/webm' })
      m_recordedChunks = []
      m_vadState = 'idle'
      if (_durationMs >= MIN_UTTERANCE_MS && _blob.size > 0) {
        _callbacks.onSpeechEnd?.(_blob)
      }
    }
    m_mediaRecorder.addEventListener('stop', _onStop)
    try {
      m_mediaRecorder.stop()
    } catch (_error) {
      const _message = _error instanceof Error ? _error.message : 'media-recorder-stop-failed'
      reportError(_message)
      m_vadState = 'idle'
    }
    startInactivityTimer()
  }

  const startRecorder = (): void => {
    if (!m_mediaStream) {
      return
    }
    try {
      m_recordedChunks = []
      m_mediaRecorder = m_mimeType
        ? new MediaRecorder(m_mediaStream, { mimeType: m_mimeType })
        : new MediaRecorder(m_mediaStream)
      m_mediaRecorder.ondataavailable = (_event) => {
        if (_event.data && _event.data.size > 0) {
          m_recordedChunks.push(_event.data)
        }
      }
      m_mediaRecorder.start()
      m_recordingStartedAt = Date.now()
      m_vadState = 'speaking'
      cancelInactivityTimer()
      _callbacks.onSpeechStart?.()
    } catch (_error) {
      const _message = _error instanceof Error ? _error.message : 'media-recorder-start-failed'
      reportError(_message)
    }
  }

  const tick = (): void => {
    if (!m_analyser) {
      return
    }
    const _buffer = new Float32Array(m_analyser.fftSize)
    m_analyser.getFloatTimeDomainData(_buffer)
    const _rms = computeRms(_buffer)
    _callbacks.onAudioLevel?.(_rms)

    if (m_vadState === 'idle') {
      if (_rms >= RMS_SPEECH_THRESHOLD) {
        m_consecutiveSpeechTicks++
        if (m_consecutiveSpeechTicks >= SPEECH_START_CONSECUTIVE_TICKS) {
          m_consecutiveSpeechTicks = 0
          startRecorder()
        }
      } else {
        m_consecutiveSpeechTicks = 0
      }
      return
    }

    if (_rms < RMS_SILENCE_THRESHOLD) {
      if (!m_silenceTimer) {
        m_silenceTimer = setTimeout(() => {
          m_silenceTimer = null
          stopRecorderAndEmit()
        }, SILENCE_HANG_MS)
      }
    } else if (m_silenceTimer) {
      clearTimeout(m_silenceTimer)
      m_silenceTimer = null
    }
  }

  const start = async (): Promise<void> => {
    if (m_mediaStream) {
      return
    }
    try {
      m_mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1
        }
      })
    } catch (_error) {
      const _message = _error instanceof Error ? _error.message : 'microphone-permission-denied'
      reportError(_message)
      throw _error
    }

    try {
      const _AudioContextCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!_AudioContextCtor) {
        throw new Error('AudioContext is not available in this environment.')
      }
      m_audioContext = new _AudioContextCtor()
      m_sourceNode = m_audioContext.createMediaStreamSource(m_mediaStream)
      m_analyser = m_audioContext.createAnalyser()
      m_analyser.fftSize = 1024
      m_analyser.smoothingTimeConstant = 0.4
      m_sourceNode.connect(m_analyser)
      m_mimeType = pickSupportedMimeType()
      m_sampleTimer = setInterval(tick, SAMPLE_INTERVAL_MS)
      startInactivityTimer()
    } catch (_error) {
      const _message = _error instanceof Error ? _error.message : 'audio-context-init-failed'
      reportError(_message)
      stop()
      throw _error
    }
  }

  const stop = (): void => {
    if (m_sampleTimer) {
      clearInterval(m_sampleTimer)
      m_sampleTimer = null
    }
    if (m_silenceTimer) {
      clearTimeout(m_silenceTimer)
      m_silenceTimer = null
    }
    cancelInactivityTimer()
    if (m_mediaRecorder && m_mediaRecorder.state !== 'inactive') {
      try {
        m_mediaRecorder.stop()
      } catch {
        // ignore — we're tearing down
      }
    }
    m_mediaRecorder = null
    m_recordedChunks = []
    if (m_sourceNode) {
      try {
        m_sourceNode.disconnect()
      } catch {
        // ignore
      }
      m_sourceNode = null
    }
    m_analyser = null
    if (m_audioContext) {
      m_audioContext.close().catch(() => {
        // ignore
      })
      m_audioContext = null
    }
    if (m_mediaStream) {
      for (const _track of m_mediaStream.getTracks()) {
        _track.stop()
      }
      m_mediaStream = null
    }
    m_vadState = 'idle'
    m_consecutiveSpeechTicks = 0
  }

  return { start, stop }
}
