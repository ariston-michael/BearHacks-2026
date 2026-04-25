import type { VoiceIntent } from '../stores/voiceStore'

export interface VoiceIntentProvider {
  parseIntent: (_transcript: string) => Promise<VoiceIntent>
}

interface OllamaResponse {
  response?: string
}

const INTENT_SYSTEM_PROMPT = `
You map user voice commands to JSON intents for desktop/web control.
Allowed actions: open_app, search_web, scroll_up, scroll_down, click, unknown.
Return strict JSON with this shape:
{"action":"open_app|search_web|scroll_up|scroll_down|click|unknown","query":"string?","appName":"string?","confidence":0.0}
No markdown. No extra keys.
`

const OLLAMA_ENDPOINT = 'http://127.0.0.1:11434/api/generate'
const OLLAMA_MODEL = 'gemma4'

function normalizeIntent(_intent: Partial<VoiceIntent>, _raw: string): VoiceIntent {
  const _safeAction = _intent.action ?? 'unknown'
  const _safeConfidence = Math.min(1, Math.max(0, _intent.confidence ?? 0))
  return {
    action: _safeAction,
    query: _intent.query,
    appName: _intent.appName,
    confidence: _safeConfidence,
    raw: _raw
  }
}

function safeJsonParse(_text: string): Partial<VoiceIntent> | null {
  try {
    const _start = _text.indexOf('{')
    const _end = _text.lastIndexOf('}')
    if (_start === -1 || _end === -1 || _end <= _start) {
      return null
    }
    const _jsonSlice = _text.slice(_start, _end + 1)
    return JSON.parse(_jsonSlice) as Partial<VoiceIntent>
  } catch {
    return null
  }
}

export class OllamaGemmaIntentProvider implements VoiceIntentProvider {
  async parseIntent(_transcript: string): Promise<VoiceIntent> {
    const _response = await fetch(OLLAMA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        prompt: `${INTENT_SYSTEM_PROMPT}\nUser command: "${_transcript}"`
      })
    })

    if (!_response.ok) {
      throw new Error(`Ollama request failed: ${_response.status}`)
    }

    const _json = (await _response.json()) as OllamaResponse
    const _raw = _json.response?.trim() ?? ''
    const _parsed = safeJsonParse(_raw)

    if (!_parsed) {
      return {
        action: 'unknown',
        confidence: 0,
        raw: _raw
      }
    }

    return normalizeIntent(_parsed, _raw)
  }
}

export class CloudIntentProvider implements VoiceIntentProvider {
  async parseIntent(_transcript: string): Promise<VoiceIntent> {
    // Placeholder: swap to your cloud endpoint without changing dashboard/store wiring.
    return {
      action: 'unknown',
      confidence: 0,
      raw: `cloud-provider-not-configured: ${_transcript}`
    }
  }
}
