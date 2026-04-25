import { useEffect, useRef } from 'react'
import { ElevenLabsScribeTranscriber } from '../lib/elevenLabsTranscriber'
import type { SpeechTranscriber } from '../lib/speechRecognition'
import { VultrGemmaIntentProvider, type VoiceIntentProvider } from '../lib/voiceIntent'
import { useVoiceStore } from '../stores/voiceStore'

const ELEVENLABS_API_KEY = import.meta.env.RENDERER_VITE_ELEVENLABS_API_KEY ?? ''
const VULTR_API_KEY = import.meta.env.RENDERER_VITE_VULTR_INFERENCE_KEY ?? ''

const m_intentProvider: VoiceIntentProvider | null = VULTR_API_KEY
  ? new VultrGemmaIntentProvider(VULTR_API_KEY)
  : null

export default function VoiceControlPanel(): React.JSX.Element {
  const _transcriberRef = useRef<SpeechTranscriber | null>(null)

  const _isListening = useVoiceStore((_state) => _state.isListening)
  const _isRecording = useVoiceStore((_state) => _state.isRecording)
  const _audioLevel = useVoiceStore((_state) => _state.audioLevel)
  const _transcript = useVoiceStore((_state) => _state.transcript)
  const _lastSegments = useVoiceStore((_state) => _state.lastSegments)
  const _lastIntent = useVoiceStore((_state) => _state.lastIntent)
  const _errorMessage = useVoiceStore((_state) => _state.errorMessage)
  const _setIsListening = useVoiceStore((_state) => _state.setIsListening)
  const _setIsRecording = useVoiceStore((_state) => _state.setIsRecording)
  const _setAudioLevel = useVoiceStore((_state) => _state.setAudioLevel)
  const _setLastIntent = useVoiceStore((_state) => _state.setLastIntent)
  const _setErrorMessage = useVoiceStore((_state) => _state.setErrorMessage)
  const _appendTranscript = useVoiceStore((_state) => _state.appendTranscript)
  const _clearVoiceState = useVoiceStore((_state) => _state.clearVoiceState)

  const _hasElevenLabsKey = ELEVENLABS_API_KEY.length > 0
  const _hasVultrKey = VULTR_API_KEY.length > 0

  useEffect(() => {
    return () => {
      _transcriberRef.current?.stop()
      _transcriberRef.current = null
    }
  }, [])

  const _startListening = async (): Promise<void> => {
    if (!_hasElevenLabsKey) {
      _setErrorMessage(
        'missing-elevenlabs-api-key: set RENDERER_VITE_ELEVENLABS_API_KEY in .env.local and restart `npm run dev`'
      )
      return
    }
    if (_transcriberRef.current) {
      return
    }

    _setErrorMessage(null)
    try {
      const _transcriber = new ElevenLabsScribeTranscriber(
        { apiKey: ELEVENLABS_API_KEY, diarize: true, languageCode: 'en' },
        {
          onStart: () => _setIsListening(true),
          onEnd: () => {
            _setIsListening(false)
            _setIsRecording(false)
            _setAudioLevel(0)
          },
          onAudioLevel: (_rms) => _setAudioLevel(_rms),
          onRecordingStart: () => _setIsRecording(true),
          onRecordingEnd: () => _setIsRecording(false),
          onTranscript: async (_result) => {
            _appendTranscript(_result.text, _result.segments)
            _setErrorMessage(null)
            if (!m_intentProvider) {
              _setErrorMessage(
                'missing-vultr-api-key: set RENDERER_VITE_VULTR_INFERENCE_KEY in .env.local to enable intent parsing'
              )
              return
            }
            try {
              const _intent = await m_intentProvider.parseIntent(_result.text)
              _setLastIntent(_intent)
            } catch (_intentError) {
              const _message =
                _intentError instanceof Error ? _intentError.message : 'intent-parse-failed'
              _setErrorMessage(_message)
            }
          },
          onError: (_message) => _setErrorMessage(_message)
        }
      )
      _transcriberRef.current = _transcriber
      await _transcriber.start()
    } catch (_error) {
      const _message =
        _error instanceof Error ? _error.message : 'failed-to-start-speech-recognition'
      _setErrorMessage(_message)
      _transcriberRef.current?.stop()
      _transcriberRef.current = null
      _setIsListening(false)
    }
  }

  const _stopListening = (): void => {
    _transcriberRef.current?.stop()
    _transcriberRef.current = null
    _setIsListening(false)
    _setIsRecording(false)
    _setAudioLevel(0)
  }

  const _onReset = (): void => {
    _clearVoiceState()
  }

  const _meterPercent = Math.min(100, Math.max(0, _audioLevel * 600))
  const _meterColor =
    _audioLevel > 0.06 ? 'bg-green-400' : _audioLevel > 0.025 ? 'bg-yellow-300' : 'bg-white/30'

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Voice Control (ElevenLabs Scribe + Vultr Gemma 4)
          </h2>
          <p className="mt-1 text-sm text-white/60">
            Energy-VAD + ElevenLabs Scribe for transcription, Vultr-hosted Gemma 4 for intent
            parsing. Speak a phrase, pause, and the parsed intent appears.
          </p>
        </div>
        {_isRecording && (
          <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300">
            Recording...
          </span>
        )}
      </div>

      {!_hasElevenLabsKey && (
        <div className="mt-3 rounded border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-200">
          ElevenLabs API key missing. Add{' '}
          <code className="rounded bg-black/40 px-1 py-0.5">RENDERER_VITE_ELEVENLABS_API_KEY</code>{' '}
          to <code className="rounded bg-black/40 px-1 py-0.5">.env.local</code> and restart the dev
          server.
        </div>
      )}

      {!_hasVultrKey && (
        <div className="mt-3 rounded border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-200">
          Vultr API key missing. Add{' '}
          <code className="rounded bg-black/40 px-1 py-0.5">RENDERER_VITE_VULTR_INFERENCE_KEY</code>{' '}
          to <code className="rounded bg-black/40 px-1 py-0.5">.env.local</code> and restart the dev
          server. Transcripts will appear, but no intent will be parsed.
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          className="rounded bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={_startListening}
          disabled={!_hasElevenLabsKey || _isListening}
        >
          {_isListening ? 'Listening...' : 'Start listening'}
        </button>
        <button
          className="rounded bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={_stopListening}
          disabled={!_isListening}
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

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-white/50">
          <span>Mic level</span>
          <span className="font-mono">{_audioLevel.toFixed(3)}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded bg-white/10">
          <div
            className={`h-full ${_meterColor} transition-[width] duration-75`}
            style={{ width: `${_meterPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div>
          <div className="mb-1 text-white/50">Transcript</div>
          <div className="min-h-[2rem] rounded bg-black/30 p-2 font-mono text-white">
            {_transcript || <span className="text-white/30">(none yet)</span>}
          </div>
        </div>

        <div>
          <div className="mb-1 text-white/50">Last utterance segments</div>
          {_lastSegments.length === 0 ? (
            <div className="text-white/30">(none yet)</div>
          ) : (
            <ul className="space-y-1">
              {_lastSegments.map((_segment, _index) => (
                <li key={_index} className="flex gap-2 font-mono text-xs">
                  <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-white/70">
                    {_segment.speakerId ?? 'unknown'}
                  </span>
                  <span className="text-white">{_segment.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-1 text-white/50">Intent</div>
          <div className="font-mono text-xs text-white">
            {_lastIntent ? (
              JSON.stringify(_lastIntent)
            ) : (
              <span className="text-white/30">(none yet)</span>
            )}
          </div>
        </div>

        {_errorMessage && (
          <div className="rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
            {_errorMessage}
          </div>
        )}
      </div>
    </section>
  )
}
