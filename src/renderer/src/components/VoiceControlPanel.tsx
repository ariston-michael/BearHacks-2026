import { useState, useRef } from 'react'
import { OllamaGemmaIntentProvider, VultrGemmaIntentProvider, VoiceIntent } from '../lib/voiceIntent'

const VULTR_KEY = import.meta.env.RENDERER_VITE_VULTR_INFERENCE_KEY ?? ''

const m_intentProvider = VULTR_KEY
  ? new VultrGemmaIntentProvider(VULTR_KEY)
  : new OllamaGemmaIntentProvider()

export default function VoiceControlPanel(): React.JSX.Element {
  const [m_input, setMInput] = useState('')
  const [m_loading, setMLoading] = useState(false)
  const [m_intent, setMIntent] = useState<VoiceIntent | null>(null)
  const [m_error, setMError] = useState<string | null>(null)
  const m_inputRef = useRef<HTMLInputElement>(null)

  const m_providerLabel = VULTR_KEY ? 'Vultr (Gemma 4)' : 'Ollama (local)'

  async function handleParse(): Promise<void> {
    const _text = m_input.trim()
    if (!_text) return
    setMLoading(true)
    setMError(null)
    setMIntent(null)
    try {
      const _result = await m_intentProvider.parseIntent(_text)
      setMIntent(_result)
    } catch (_err) {
      setMError(_err instanceof Error ? _err.message : String(_err))
    } finally {
      setMLoading(false)
    }
  }

  function handleKeyDown(_e: React.KeyboardEvent<HTMLInputElement>): void {
    if (_e.key === 'Enter') {
      void handleParse()
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 rounded-xl border border-white/10 bg-white/5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Voice Intent</h2>
        <span className="text-xs text-white/40 font-mono">{m_providerLabel}</span>
      </div>

      {!VULTR_KEY && (
        <p className="text-xs text-yellow-400/80 bg-yellow-400/10 rounded-lg px-3 py-2">
          No <code className="font-mono">RENDERER_VITE_VULTR_INFERENCE_KEY</code> found — falling
          back to local Ollama. Set the key in <code className="font-mono">.env.local</code>.
        </p>
      )}

      <div className="flex gap-2">
        <input
          ref={m_inputRef}
          type="text"
          value={m_input}
          onChange={(_e) => setMInput(_e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type or paste a command…"
          className="flex-1 bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/30"
        />
        <button
          onClick={() => void handleParse()}
          disabled={m_loading || !m_input.trim()}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-40 hover:bg-indigo-500 transition-colors"
        >
          {m_loading ? '…' : 'Parse'}
        </button>
      </div>

      {m_error && (
        <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2 font-mono break-all">
          {m_error}
        </p>
      )}

      {m_intent && (
        <div className="rounded-lg bg-black/30 border border-white/10 p-3">
          <p className="text-xs text-white/40 mb-1 font-mono">Intent result</p>
          <pre className="text-xs text-green-300 font-mono whitespace-pre-wrap break-all">
            {JSON.stringify(m_intent, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
