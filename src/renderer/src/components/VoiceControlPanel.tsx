import { useCallback, useEffect, useRef, useState } from 'react'
import { ElevenLabsScribeTranscriber } from '../lib/elevenLabsTranscriber'
import { ElevenLabsTtsService } from '../lib/elevenLabsTts'
import { WakeWordDetector } from '../lib/wakeWord'
import type { SpeechTranscriber } from '../lib/speechRecognition'
import { dispatchVoiceIntent } from '../lib/voiceActionDispatcher'
import { VultrGemmaIntentProvider, type VoiceIntentProvider } from '../lib/voiceIntent'
import { useVoiceStore } from '../stores/voiceStore'
import { useVoiceSettingsStore } from '../stores/voiceSettingsStore'
import type { VoiceIntent } from '../stores/voiceStore'

const ELEVENLABS_API_KEY = import.meta.env.RENDERER_VITE_ELEVENLABS_API_KEY ?? ''
const VULTR_API_KEY = import.meta.env.RENDERER_VITE_VULTR_INFERENCE_KEY ?? ''

const m_intentProvider: VoiceIntentProvider | null = VULTR_API_KEY
  ? new VultrGemmaIntentProvider(VULTR_API_KEY, 2)
  : null

function buildAckPhrase(_intent: VoiceIntent): string {
  switch (_intent.action) {
    case 'search_web':
      return `Searching for ${_intent.query ?? 'that'}`
    case 'open_app':
      return `Opening ${_intent.appName ?? 'that'}`
    case 'scroll_up':
      return 'Scrolling up'
    case 'scroll_down':
      return 'Scrolling down'
    case 'click':
      return 'Done'
    default:
      return ''
  }
}

function SpeakerIcon({ _muted }: { _muted: boolean }): React.JSX.Element {
  if (_muted) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M13 4.07V3a1 1 0 0 0-1.707-.707l-4 4H4a1 1 0 0 0-1 1v5.414a1 1 0 0 0 1 1h.586l1.5 1.5A1 1 0 0 0 8 15v-1.586l2.293 2.293A1 1 0 0 0 12 15v-1.07A5.002 5.002 0 0 0 13 4.07zM3.707 2.293a1 1 0 0 0-1.414 1.414l18 18a1 1 0 0 0 1.414-1.414l-18-18z" />
      </svg>
    )
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  )
}

export default function VoiceControlPanel(): React.JSX.Element {
  const _transcriberRef = useRef<SpeechTranscriber | null>(null)
  const _wakeWordRef = useRef<WakeWordDetector | null>(null)
  const _ttsRef = useRef<ElevenLabsTtsService | null>(null)
  // Holds the latest _startListening so startWakeWord can call it without a stale closure
  const _startListeningFnRef = useRef<() => Promise<void>>(async () => {})
  const [_isWakeWordMode, _setIsWakeWordMode] = useState(true)

  function getTts(): ElevenLabsTtsService {
    if (!_ttsRef.current) _ttsRef.current = new ElevenLabsTtsService()
    return _ttsRef.current
  }

  const _isListening = useVoiceStore((_state) => _state.isListening)
  const _isRecording = useVoiceStore((_state) => _state.isRecording)
  const _audioLevel = useVoiceStore((_state) => _state.audioLevel)
  const _transcript = useVoiceStore((_state) => _state.transcript)
  const _lastSegments = useVoiceStore((_state) => _state.lastSegments)
  const _lastIntent = useVoiceStore((_state) => _state.lastIntent)
  const _lastActionResult = useVoiceStore((_state) => _state.lastActionResult)
  const _errorMessage = useVoiceStore((_state) => _state.errorMessage)
  const _setIsListening = useVoiceStore((_state) => _state.setIsListening)
  const _setIsRecording = useVoiceStore((_state) => _state.setIsRecording)
  const _setAudioLevel = useVoiceStore((_state) => _state.setAudioLevel)
  const _setTranscript = useVoiceStore((_state) => _state.setTranscript)
  const _setLastSegments = useVoiceStore((_state) => _state.setLastSegments)
  const _setLastIntent = useVoiceStore((_state) => _state.setLastIntent)
  const _setLastActionResult = useVoiceStore((_state) => _state.setLastActionResult)
  const _setErrorMessage = useVoiceStore((_state) => _state.setErrorMessage)
  const _appendTranscript = useVoiceStore((_state) => _state.appendTranscript)
  const _clearVoiceState = useVoiceStore((_state) => _state.clearVoiceState)

  const _acknowledgementsEnabled = useVoiceSettingsStore((_s) => _s.acknowledgementsEnabled)
  const _setAcknowledgementsEnabled = useVoiceSettingsStore((_s) => _s.setAcknowledgementsEnabled)
  const _voiceId = useVoiceSettingsStore((_s) => _s.voiceId)
  const _modelId = useVoiceSettingsStore((_s) => _s.modelId)
  const _stability = useVoiceSettingsStore((_s) => _s.stability)
  const _similarityBoost = useVoiceSettingsStore((_s) => _s.similarityBoost)
  const _style = useVoiceSettingsStore((_s) => _s.style)
  const _useSpeakerBoost = useVoiceSettingsStore((_s) => _s.useSpeakerBoost)
  const _speed = useVoiceSettingsStore((_s) => _s.speed)

  const _hasElevenLabsKey = ELEVENLABS_API_KEY.length > 0
  const _hasVultrKey = VULTR_API_KEY.length > 0

  const startWakeWord = useCallback((): void => {
    // #region agent log
    fetch('http://127.0.0.1:7571/ingest/fa9108c5-730f-4e3a-a373-dbb935263b74',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9c84b0'},body:JSON.stringify({sessionId:'9c84b0',runId:'initial',hypothesisId:'H1,H2',location:'src/renderer/src/components/VoiceControlPanel.tsx:startWakeWord',message:'startWakeWord invoked',data:{hasWakeDetector:Boolean(_wakeWordRef.current),hasElevenLabsKey:Boolean(ELEVENLABS_API_KEY),isWakeWordMode:_isWakeWordMode,isListening:_isListening},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    if (_wakeWordRef.current) {
      return
    }
    if (!ELEVENLABS_API_KEY) {
      _setIsWakeWordMode(false)
      _setErrorMessage(
        'missing-elevenlabs-api-key: set RENDERER_VITE_ELEVENLABS_API_KEY in .env.local and restart `npm run dev`'
      )
      return
    }
    const _detector = new WakeWordDetector({
      apiKey: ELEVENLABS_API_KEY,
      onWakeWord: () => {
        // #region agent log
        fetch('http://127.0.0.1:7571/ingest/fa9108c5-730f-4e3a-a373-dbb935263b74',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9c84b0'},body:JSON.stringify({sessionId:'9c84b0',runId:'initial',hypothesisId:'H3',location:'src/renderer/src/components/VoiceControlPanel.tsx:startWakeWord:onWakeWord',message:'Wake callback reached panel, starting full listener',data:{isWakeWordMode:_isWakeWordMode,isListening:_isListening},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
        _wakeWordRef.current = null
        _setIsWakeWordMode(false)
        void _startListeningFnRef.current()
      },
      onError: (_message) => {
        // #region agent log
        fetch('http://127.0.0.1:7571/ingest/fa9108c5-730f-4e3a-a373-dbb935263b74',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'9c84b0'},body:JSON.stringify({sessionId:'9c84b0',runId:'initial',hypothesisId:'H2',location:'src/renderer/src/components/VoiceControlPanel.tsx:startWakeWord:onError',message:'Wake detector error surfaced in panel',data:{error:_message},timestamp:Date.now()})}).catch(()=>{})
        // #endregion
        _setErrorMessage(_message)
      }
    })
    _wakeWordRef.current = _detector
    _setIsWakeWordMode(true)
    _detector.start()
  }, [_setIsWakeWordMode, _setErrorMessage])

  const _speakAck = (_intent: VoiceIntent): void => {
    if (!_acknowledgementsEnabled || !_hasElevenLabsKey) {
      return
    }
    const _phrase = buildAckPhrase(_intent)
    if (!_phrase) {
      return
    }
    void getTts()
      .speak(_phrase, {
        apiKey: ELEVENLABS_API_KEY,
        voiceId: _voiceId,
        modelId: _modelId,
        voiceSettings: {
          stability: _stability,
          similarityBoost: _similarityBoost,
          style: _style,
          useSpeakerBoost: _useSpeakerBoost,
          speed: _speed
        }
      })
      .catch((_err) => {
        console.warn('[VoiceControlPanel] TTS acknowledgement failed:', _err)
      })
  }

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
    _setTranscript('')
    _setLastSegments([])
    try {
      const _transcriber = new ElevenLabsScribeTranscriber(
        { apiKey: ELEVENLABS_API_KEY, diarize: true, languageCode: 'en', isolateAudio: false, inactivityTimeoutMs: 1500 },
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
          onInactivityTimeout: () => {
            _stopListening()
            startWakeWord()
          },
          onTranscript: async (_result) => {
            // #region agent log
            fetch('http://127.0.0.1:7571/ingest/fa9108c5-730f-4e3a-a373-dbb935263b74',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b555ed'},body:JSON.stringify({sessionId:'b555ed',runId:'initial',hypothesisId:'H2',location:'src/renderer/src/components/VoiceControlPanel.tsx:onTranscript',message:'Transcript callback started',data:{textLength:_result.text.length,textPrefix:_result.text.slice(0,120),segmentCount:_result.segments.length,segmentWindows:_result.segments.map((_s)=>({speakerId:_s.speakerId,startSec:_s.startSec,endSec:_s.endSec,textLength:_s.text.length}))},timestamp:Date.now()})}).catch(()=>{})
            // #endregion
            _appendTranscript(_result.text, _result.segments)
            _setErrorMessage(null)
            if (!m_intentProvider) {
              _setErrorMessage(
                'missing-vultr-api-key: set RENDERER_VITE_VULTR_INFERENCE_KEY in .env.local to enable intent parsing'
              )
              return
            }
            try {
              const _intent = await m_intentProvider.parseIntent(_result.text, {
                segments: _result.segments
              })
              _setLastIntent(_intent)
              const _actionResult = await dispatchVoiceIntent(_intent)
              _setLastActionResult(_actionResult)
              // #region agent log
              fetch('http://127.0.0.1:7571/ingest/fa9108c5-730f-4e3a-a373-dbb935263b74',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b555ed'},body:JSON.stringify({sessionId:'b555ed',runId:'initial',hypothesisId:'H1,H2,H3,H4',location:'src/renderer/src/components/VoiceControlPanel.tsx:onTranscript',message:'Intent dispatch completed',data:{intentAction:_intent.action,confidence:_intent.confidence,linkIndex:_intent.linkIndex,hasLinkText:Boolean(_intent.linkText?.trim()),actionOk:_actionResult.ok,actionMessage:_actionResult.message},timestamp:Date.now()})}).catch(()=>{})
              // #endregion
              if (_actionResult.ok) {
                _speakAck(_intent)
              }
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

  const _onStop = (): void => {
    _wakeWordRef.current?.stop()
    _wakeWordRef.current = null
    _stopListening()
    // Return to idle: restart wake word detection
    startWakeWord()
  }

  const _onStartListening = (): void => {
    _wakeWordRef.current?.stop()
    _wakeWordRef.current = null
    _setIsWakeWordMode(false)
    void _startListening()
  }

  const _onReset = (): void => {
    _clearVoiceState()
  }

  // Keep _startListeningFnRef current so startWakeWord never holds a stale closure
  useEffect(() => {
    _startListeningFnRef.current = _startListening
  })

  useEffect(() => {
    return () => {
      _wakeWordRef.current?.stop()
      _wakeWordRef.current = null
      _transcriberRef.current?.stop()
      _transcriberRef.current = null
      _ttsRef.current?.cancel()
    }
  }, [startWakeWord])

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
            Energy-VAD + ElevenLabs Scribe for transcription, Vultr Gemma 4 for intent + action
            (search, open app, scroll). Speak a phrase, pause, and results appear below.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {_isWakeWordMode && (
            <span className="flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-300">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-400 animate-flicker" />
              Waiting for &ldquo;Hey Airflow&rdquo;
            </span>
          )}
          {_isListening && !_isWakeWordMode && (
            <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-300">
              Priority Voice Active
            </span>
          )}
          {_isRecording && (
            <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300">
              Recording...
            </span>
          )}
          <button
            onClick={() => _setAcknowledgementsEnabled(!_acknowledgementsEnabled)}
            title={_acknowledgementsEnabled ? 'Mute voice acknowledgements' : 'Unmute voice acknowledgements'}
            className={`rounded-lg p-2 transition-colors ${
              _acknowledgementsEnabled
                ? 'text-accent hover:bg-white/10'
                : 'text-white/30 hover:bg-white/10 hover:text-white/60'
            }`}
          >
            <SpeakerIcon _muted={!_acknowledgementsEnabled} />
          </button>
        </div>
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
          className={`rounded px-3 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            _isWakeWordMode
              ? 'bg-blue-600 hover:bg-blue-700'
              : 'bg-accent hover:opacity-90'
          }`}
          onClick={_isWakeWordMode ? _onStop : startWakeWord}
          disabled={_isListening}
        >
          {_isWakeWordMode ? 'Stop Voice Assistant' : 'Start Voice Assistant'}
        </button>
        <button
          className="rounded bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={_onStartListening}
          disabled={!_hasElevenLabsKey || _isListening}
        >
          {_isListening ? 'Listening...' : 'Start listening'}
        </button>
        <button
          className="rounded bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={_onStop}
          disabled={!_isListening && !_isWakeWordMode}
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

        <div>
          <div className="mb-1 text-white/50">Action result</div>
          <div
            className={`font-mono text-xs ${
              _lastActionResult?.ok ? 'text-emerald-300' : 'text-amber-200/90'
            }`}
          >
            {_lastActionResult ? (
              _lastActionResult.message
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
