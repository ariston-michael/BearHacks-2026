import { useEffect, useRef, useState } from 'react'
import { fetchElevenLabsVoices, ElevenLabsTtsService } from '../lib/elevenLabsTts'
import { useVoiceSettingsStore, ELEVENLABS_MODELS } from '../stores/voiceSettingsStore'

const ELEVENLABS_API_KEY = import.meta.env.RENDERER_VITE_ELEVENLABS_API_KEY ?? ''

const m_tts = new ElevenLabsTtsService()

function SliderRow({
  _label,
  _value,
  _min,
  _max,
  _step,
  _onChange,
  _format
}: {
  _label: string
  _value: number
  _min: number
  _max: number
  _step: number
  _onChange: (_v: number) => void
  _format?: (_v: number) => string
}): React.JSX.Element {
  const display = _format ? _format(_value) : _value.toFixed(2)
  return (
    <div className="flex items-center gap-3">
      <label className="w-36 shrink-0 text-sm text-white/70">{_label}</label>
      <input
        type="range"
        min={_min}
        max={_max}
        step={_step}
        value={_value}
        onChange={(_e) => _onChange(parseFloat(_e.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded bg-white/20 accent-accent"
      />
      <span className="w-10 text-right font-mono text-xs text-white/60">{display}</span>
    </div>
  )
}

export default function VoiceSettingsPage(): React.JSX.Element {
  const _voiceId = useVoiceSettingsStore((_s) => _s.voiceId)
  const _modelId = useVoiceSettingsStore((_s) => _s.modelId)
  const _stability = useVoiceSettingsStore((_s) => _s.stability)
  const _similarityBoost = useVoiceSettingsStore((_s) => _s.similarityBoost)
  const _style = useVoiceSettingsStore((_s) => _s.style)
  const _useSpeakerBoost = useVoiceSettingsStore((_s) => _s.useSpeakerBoost)
  const _speed = useVoiceSettingsStore((_s) => _s.speed)
  const _acknowledgementsEnabled = useVoiceSettingsStore((_s) => _s.acknowledgementsEnabled)
  const _availableVoices = useVoiceSettingsStore((_s) => _s.availableVoices)
  const _setVoiceId = useVoiceSettingsStore((_s) => _s.setVoiceId)
  const _setModelId = useVoiceSettingsStore((_s) => _s.setModelId)
  const _setStability = useVoiceSettingsStore((_s) => _s.setStability)
  const _setSimilarityBoost = useVoiceSettingsStore((_s) => _s.setSimilarityBoost)
  const _setStyle = useVoiceSettingsStore((_s) => _s.setStyle)
  const _setUseSpeakerBoost = useVoiceSettingsStore((_s) => _s.setUseSpeakerBoost)
  const _setSpeed = useVoiceSettingsStore((_s) => _s.setSpeed)
  const _setAcknowledgementsEnabled = useVoiceSettingsStore((_s) => _s.setAcknowledgementsEnabled)
  const _setAvailableVoices = useVoiceSettingsStore((_s) => _s.setAvailableVoices)

  const [m_voicesLoading, setM_voicesLoading] = useState(false)
  const [m_voicesError, setM_voicesError] = useState<string | null>(null)
  const [m_testPlaying, setM_testPlaying] = useState(false)
  const [m_testError, setM_testError] = useState<string | null>(null)
  const m_fetchedRef = useRef(false)

  const _hasApiKey = ELEVENLABS_API_KEY.length > 0

  useEffect(() => {
    if (!_hasApiKey || m_fetchedRef.current || _availableVoices.length > 0) {
      return
    }
    m_fetchedRef.current = true
    setM_voicesLoading(true)
    setM_voicesError(null)
    fetchElevenLabsVoices(ELEVENLABS_API_KEY)
      .then((_voices) => {
        _setAvailableVoices(_voices)
      })
      .catch((_err) => {
        setM_voicesError(_err instanceof Error ? _err.message : 'failed-to-fetch-voices')
      })
      .finally(() => {
        setM_voicesLoading(false)
      })
  }, [_hasApiKey, _availableVoices.length, _setAvailableVoices])

  const _onTestVoice = async (): Promise<void> => {
    if (!_hasApiKey) {
      return
    }
    setM_testError(null)
    setM_testPlaying(true)
    try {
      await m_tts.speak("Hello, I'm ready to help you.", {
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
    } catch (_err) {
      setM_testError(_err instanceof Error ? _err.message : 'tts-test-failed')
    } finally {
      setM_testPlaying(false)
    }
  }

  const _onStopTest = (): void => {
    m_tts.cancel()
    setM_testPlaying(false)
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <h1 className="shrink-0 text-xl font-semibold text-white">Voice Settings</h1>

      {!_hasApiKey && (
        <div className="rounded border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-200">
          ElevenLabs API key missing. Add{' '}
          <code className="rounded bg-black/40 px-1 py-0.5">RENDERER_VITE_ELEVENLABS_API_KEY</code>{' '}
          to <code className="rounded bg-black/40 px-1 py-0.5">.env.local</code> and restart the dev
          server.
        </div>
      )}

      <div className="flex flex-col gap-5">
        {/* Acknowledgements toggle */}
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-white">Voice Acknowledgements</div>
            <div className="mt-0.5 text-xs text-white/50">
              Speak a confirmation aloud after each detected command
            </div>
          </div>
          <button
            onClick={() => _setAcknowledgementsEnabled(!_acknowledgementsEnabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              _acknowledgementsEnabled ? 'bg-accent' : 'bg-white/20'
            }`}
            role="switch"
            aria-checked={_acknowledgementsEnabled}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                _acknowledgementsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Voice picker */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Voice</h2>
          {m_voicesLoading && (
            <p className="text-xs text-white/50">Loading voices from ElevenLabs...</p>
          )}
          {m_voicesError && (
            <p className="text-xs text-red-300">{m_voicesError}</p>
          )}
          {!m_voicesLoading && _availableVoices.length > 0 && (
            <select
              value={_voiceId}
              onChange={(_e) => _setVoiceId(_e.target.value)}
              className="w-full rounded border border-white/10 bg-[#0a0a1a] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {_availableVoices.map((_v) => (
                <option key={_v.voice_id} value={_v.voice_id}>
                  {_v.name}
                  {_v.category ? ` — ${_v.category}` : ''}
                </option>
              ))}
            </select>
          )}
          {!m_voicesLoading && _availableVoices.length === 0 && !m_voicesError && _hasApiKey && (
            <button
              className="text-xs text-accent underline hover:opacity-80"
              onClick={() => {
                m_fetchedRef.current = false
                _setAvailableVoices([])
              }}
            >
              Retry loading voices
            </button>
          )}
          {!_hasApiKey && (
            <p className="text-xs text-white/30">API key required to list voices.</p>
          )}
        </div>

        {/* Model picker */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Model</h2>
          <select
            value={_modelId}
            onChange={(_e) => _setModelId(_e.target.value)}
            className="w-full rounded border border-white/10 bg-[#0a0a1a] px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {ELEVENLABS_MODELS.map((_m) => (
              <option key={_m.id} value={_m.id}>
                {_m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Voice parameters */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-4 text-sm font-semibold text-white">Voice Parameters</h2>
          <div className="flex flex-col gap-4">
            <SliderRow
              _label="Stability"
              _value={_stability}
              _min={0}
              _max={1}
              _step={0.01}
              _onChange={_setStability}
            />
            <SliderRow
              _label="Similarity Boost"
              _value={_similarityBoost}
              _min={0}
              _max={1}
              _step={0.01}
              _onChange={_setSimilarityBoost}
            />
            <SliderRow
              _label="Style"
              _value={_style}
              _min={0}
              _max={1}
              _step={0.01}
              _onChange={_setStyle}
            />
            <SliderRow
              _label="Speed"
              _value={_speed}
              _min={0.7}
              _max={1.2}
              _step={0.05}
              _onChange={_setSpeed}
              _format={(_v) => `${_v.toFixed(2)}x`}
            />
            <div className="flex items-center gap-3">
              <label className="w-36 shrink-0 text-sm text-white/70">Speaker Boost</label>
              <button
                onClick={() => _setUseSpeakerBoost(!_useSpeakerBoost)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                  _useSpeakerBoost ? 'bg-accent' : 'bg-white/20'
                }`}
                role="switch"
                aria-checked={_useSpeakerBoost}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                    _useSpeakerBoost ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-xs text-white/50">
                {_useSpeakerBoost ? 'On' : 'Off'}
              </span>
            </div>
          </div>
        </div>

        {/* Test voice */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Test Voice</h2>
          <p className="mb-3 text-xs text-white/50">
            Plays <span className="italic">&ldquo;Hello, I&apos;m ready to help you.&rdquo;</span> with the current settings.
          </p>
          <div className="flex gap-2">
            <button
              className="rounded bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={_onTestVoice}
              disabled={!_hasApiKey || m_testPlaying}
            >
              {m_testPlaying ? 'Playing...' : 'Play sample'}
            </button>
            {m_testPlaying && (
              <button
                className="rounded bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/20"
                onClick={_onStopTest}
              >
                Stop
              </button>
            )}
          </div>
          {m_testError && (
            <div className="mt-2 rounded border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
              {m_testError}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
