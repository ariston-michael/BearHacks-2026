// Always-on wake word detector.
//
// Uses the browser's SpeechRecognition API (Chromium's built-in speech
// recognition, available in Electron) in continuous + interimResults mode to
// listen for the wake phrase "Hey AirControl" at minimal CPU cost. When the
// phrase is detected the onWakeWord callback fires exactly once per activation
// cycle - the caller is responsible for stopping the detector and starting the
// full ElevenLabs transcriber.

interface WakeSpeechRecognitionAlternative {
  transcript: string
}

interface WakeSpeechRecognitionResult {
  readonly length: number
  readonly isFinal: boolean
  item: (_index: number) => WakeSpeechRecognitionAlternative
  [_index: number]: WakeSpeechRecognitionAlternative
}

interface WakeSpeechRecognitionResultList {
  readonly length: number
  item: (_index: number) => WakeSpeechRecognitionResult
  [_index: number]: WakeSpeechRecognitionResult
}

interface WakeSpeechRecognitionEvent {
  readonly resultIndex: number
  readonly results: WakeSpeechRecognitionResultList
}

interface WakeSpeechRecognitionErrorEvent {
  readonly error: string
}

interface WakeSpeechRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onresult: ((_event: WakeSpeechRecognitionEvent) => void) | null
  onerror: ((_event: WakeSpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start: () => void
  abort: () => void
}

const WAKE_PHRASES = [
  'hey aircontrol',
  'hey air control',
  'hey ercontrol',
  'hey aircontroll',
  'hey air-control'
]

export interface WakeWordCallbacks {
  onWakeWord: () => void
  onError?: (_message: string) => void
}

type SpeechRecognitionCtor = new () => WakeSpeechRecognition

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  const _w = window as unknown as Record<string, unknown>
  const _ctor =
    (_w['SpeechRecognition'] as SpeechRecognitionCtor | undefined) ??
    (_w['webkitSpeechRecognition'] as SpeechRecognitionCtor | undefined) ??
    null
  return _ctor
}

function containsWakePhrase(_text: string): boolean {
  const _normalized = _text.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim()
  return WAKE_PHRASES.some((_phrase) => _normalized.includes(_phrase))
}

export class WakeWordDetector {
  private readonly m_callbacks: WakeWordCallbacks
  private m_recognition: WakeSpeechRecognition | null = null
  private m_stopped = false

  constructor(_callbacks: WakeWordCallbacks) {
    this.m_callbacks = _callbacks
  }

  start(): void {
    const _Ctor = getSpeechRecognitionCtor()
    if (!_Ctor) {
      this.m_callbacks.onError?.(
        'wake-word-unavailable: SpeechRecognition API is not available in this environment'
      )
      return
    }
    this.m_stopped = false
    this.startRecognition(_Ctor)
  }

  stop(): void {
    this.m_stopped = true
    if (this.m_recognition) {
      this.m_recognition.onend = null
      try {
        this.m_recognition.abort()
      } catch {
        // ignore - may already be stopped
      }
      this.m_recognition = null
    }
  }

  private startRecognition(_Ctor: SpeechRecognitionCtor): void {
    if (this.m_stopped) {
      return
    }
    const _rec = new _Ctor()
    _rec.continuous = true
    _rec.interimResults = true
    _rec.lang = 'en-US'
    _rec.maxAlternatives = 1

    _rec.onresult = (_event: WakeSpeechRecognitionEvent) => {
      for (let _i = _event.resultIndex; _i < _event.results.length; _i++) {
        const _transcript = _event.results[_i][0].transcript
        if (containsWakePhrase(_transcript)) {
          this.stop()
          this.m_callbacks.onWakeWord()
          return
        }
      }
    }

    _rec.onerror = (_event: WakeSpeechRecognitionErrorEvent) => {
      if (_event.error === 'no-speech' || _event.error === 'aborted') {
        return
      }
      if (_event.error === 'not-allowed') {
        this.m_stopped = true
        this.m_callbacks.onError?.(
          'wake-word-permission-denied: microphone permission was denied'
        )
        return
      }
      // Non-fatal errors - the onend handler will restart
    }

    _rec.onend = () => {
      this.m_recognition = null
      if (!this.m_stopped) {
        // Auto-restart so detection is always-on
        setTimeout(() => {
          if (!this.m_stopped) {
            this.startRecognition(_Ctor)
          }
        }, 100)
      }
    }

    this.m_recognition = _rec
    try {
      _rec.start()
    } catch (_err) {
      this.m_recognition = null
      const _message = _err instanceof Error ? _err.message : 'wake-word-start-failed'
      this.m_callbacks.onError?.(_message)
    }
  }
}
