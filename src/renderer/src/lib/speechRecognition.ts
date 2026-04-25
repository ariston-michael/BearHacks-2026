export interface SpeechRecognizer {
  start: () => void
  stop: () => void
}

interface SpeechCallbacks {
  onStart?: () => void
  onEnd?: () => void
  onResult: (_transcript: string) => void
  onError?: (_message: string) => void
}

interface BrowserSpeechRecognitionConstructor {
  new (): BrowserSpeechRecognition
}

interface BrowserSpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null
}

interface BrowserSpeechRecognitionAlternative {
  transcript: string
}

interface BrowserSpeechRecognitionEvent {
  results: ArrayLike<ArrayLike<BrowserSpeechRecognitionAlternative>>
}

interface BrowserSpeechRecognitionErrorEvent {
  error: string
}

interface BrowserWindowWithSpeechRecognition extends Window {
  webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
  SpeechRecognition?: BrowserSpeechRecognitionConstructor
}

export function createSpeechRecognizer(_callbacks: SpeechCallbacks): SpeechRecognizer {
  const _window = window as BrowserWindowWithSpeechRecognition
  const _SpeechRecognition = _window.SpeechRecognition ?? _window.webkitSpeechRecognition

  if (!_SpeechRecognition) {
    throw new Error('SpeechRecognition API is not available in this environment.')
  }

  const _recognizer = new _SpeechRecognition()
  _recognizer.continuous = true
  _recognizer.interimResults = false
  _recognizer.lang = 'en-US'

  _recognizer.onstart = () => _callbacks.onStart?.()
  _recognizer.onend = () => _callbacks.onEnd?.()
  _recognizer.onresult = (_event) => {
    const _lastResult = _event.results[_event.results.length - 1]
    const _transcript = _lastResult?.[0]?.transcript?.trim()
    if (_transcript) {
      _callbacks.onResult(_transcript)
    }
  }
  _recognizer.onerror = (_event) => {
    _callbacks.onError?.(_event.error ?? 'speech-recognition-error')
  }

  return {
    start: () => _recognizer.start(),
    stop: () => _recognizer.stop()
  }
}
