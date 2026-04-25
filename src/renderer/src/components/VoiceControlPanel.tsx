import { useRef } from 'react'
import { createSpeechRecognizer, type SpeechRecognizer } from '../lib/speechRecognition'
import { OllamaGemmaIntentProvider } from '../lib/voiceIntent'
import { useVoiceStore } from '../stores/voiceStore'

const m_intentProvider = new OllamaGemmaIntentProvider()

export default function VoiceControlPanel(): React.JSX.Element {
  const _recognizerRef = useRef<SpeechRecognizer | null>(null)

  const _isListening = useVoiceStore((_state) => _state.isListening)
  const _transcript = useVoiceStore((_state) => _state.transcript)
  const _lastIntent = useVoiceStore((_state) => _state.lastIntent)
  const _errorMessage = useVoiceStore((_state) => _state.errorMessage)
  const _setIsListening = useVoiceStore((_state) => _state.setIsListening)
  const _setTranscript = useVoiceStore((_state) => _state.setTranscript)
  const _setLastIntent = useVoiceStore((_state) => _state.setLastIntent)
  const _setErrorMessage = useVoiceStore((_state) => _state.setErrorMessage)
  const _clearVoiceState = useVoiceStore((_state) => _state.clearVoiceState)

  const _startListening = (): void => {
    if (_recognizerRef.current) {
      _recognizerRef.current.start()
      return
    }

    try {
      const _recognizer = createSpeechRecognizer({
        onStart: () => _setIsListening(true),
        onEnd: () => _setIsListening(false),
        onResult: async (_recognizedText) => {
          _setTranscript(_recognizedText)
          _setErrorMessage(null)
          try {
            const _intent = await m_intentProvider.parseIntent(_recognizedText)
            _setLastIntent(_intent)
          } catch (_error) {
            const _message = _error instanceof Error ? _error.message : 'intent-parse-failed'
            _setErrorMessage(_message)
          }
        },
        onError: (_message) => _setErrorMessage(_message)
      })

      _recognizerRef.current = _recognizer
      _recognizer.start()
    } catch (_error) {
      const _message =
        _error instanceof Error ? _error.message : 'failed-to-start-speech-recognition'
      _setErrorMessage(_message)
    }
  }

  const _stopListening = (): void => {
    _recognizerRef.current?.stop()
    _setIsListening(false)
  }

  const _onReset = (): void => {
    _clearVoiceState()
  }

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="text-lg font-semibold text-white">Voice Control (STT + Gemma)</h2>
      <p className="mt-1 text-sm text-white/60">
        STT runs in-browser for now. Intent parsing uses local Ollama Gemma.
      </p>

      <div className="mt-4 flex gap-2">
        <button
          className="rounded bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          onClick={_startListening}
        >
          {_isListening ? 'Listening...' : 'Start listening'}
        </button>
        <button
          className="rounded bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
          onClick={_stopListening}
        >
          Stop
        </button>
        <button
          className="rounded bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
          onClick={_onReset}
        >
          Reset
        </button>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div>
          <span className="text-white/50">Transcript:</span>{' '}
          <span className="text-white">{_transcript || '(none yet)'}</span>
        </div>
        <div>
          <span className="text-white/50">Intent:</span>{' '}
          <span className="text-white">{_lastIntent ? JSON.stringify(_lastIntent) : '(none yet)'}</span>
        </div>
        {_errorMessage && (
          <div>
            <span className="text-red-300">Error:</span> <span>{_errorMessage}</span>
          </div>
        )}
      </div>
    </section>
  )
}
