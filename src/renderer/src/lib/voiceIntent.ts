export interface VoiceIntent {
  action: string
  target?: string
  value?: string
  confidence: number
  raw: string
}

export interface VoiceIntentProvider {
  parseIntent: (_transcript: string) => Promise<VoiceIntent>
}

const INTENT_SYSTEM_PROMPT = `You are a voice command parser. Convert the user's spoken command into a structured JSON intent.

Respond ONLY with a single JSON object — no markdown, no explanation. Use this schema:
{
  "action": "<snake_case action name>",
  "target": "<optional target app, file, or URL>",
  "value": "<optional extra value>",
  "confidence": <0.0–1.0>
}

Common actions: open_app, close_app, search_web, type_text, scroll_up, scroll_down,
click, take_screenshot, set_volume, play_media, pause_media, stop_media, unknown.

If the command is unclear use action "unknown" with confidence below 0.4.`

function safeJsonParse(_raw: string): Record<string, unknown> | null {
  const _match = _raw.match(/\{[\s\S]*\}/)
  if (!_match) return null
  try {
    return JSON.parse(_match[0]) as Record<string, unknown>
  } catch {
    return null
  }
}

function normalizeIntent(_parsed: Record<string, unknown> | null, _transcript: string): VoiceIntent {
  if (!_parsed || typeof _parsed.action !== 'string') {
    return { action: 'unknown', confidence: 0, raw: _transcript }
  }
  return {
    action: _parsed.action,
    target: typeof _parsed.target === 'string' ? _parsed.target : undefined,
    value: typeof _parsed.value === 'string' ? _parsed.value : undefined,
    confidence: typeof _parsed.confidence === 'number' ? _parsed.confidence : 0.5,
    raw: _transcript
  }
}

// ---------------------------------------------------------------------------
// Ollama (local) provider — fallback when no Vultr key is configured
// ---------------------------------------------------------------------------

const OLLAMA_ENDPOINT = 'http://127.0.0.1:11434/api/generate'
const OLLAMA_MODEL = 'gemma4'

export class OllamaGemmaIntentProvider implements VoiceIntentProvider {
  async parseIntent(_transcript: string): Promise<VoiceIntent> {
    const _response = await fetch(OLLAMA_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: `${INTENT_SYSTEM_PROMPT}\n\nUser command: "${_transcript}"`,
        stream: false
      })
    })

    if (!_response.ok) {
      throw new Error(`Ollama error ${_response.status}: ${await _response.text()}`)
    }

    const _data = (await _response.json()) as { response?: string }
    return normalizeIntent(safeJsonParse(_data.response ?? ''), _transcript)
  }
}

// ---------------------------------------------------------------------------
// Vultr Serverless Inference provider
// ---------------------------------------------------------------------------

const VULTR_INFERENCE_ENDPOINT = 'https://api.vultrinference.com/v1/chat/completions'
const VULTR_GEMMA_MODEL = 'gemma-4-26B-A4B-it'

export class VultrGemmaIntentProvider implements VoiceIntentProvider {
  constructor(private readonly m_apiKey: string) {}

  async parseIntent(_transcript: string): Promise<VoiceIntent> {
    let _response: Response
    try {
      _response = await fetch(VULTR_INFERENCE_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.m_apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: VULTR_GEMMA_MODEL,
          messages: [
            { role: 'system', content: INTENT_SYSTEM_PROMPT },
            { role: 'user', content: `User command: "${_transcript}"` }
          ],
          max_tokens: 128,
          temperature: 0.1
        })
      })
    } catch (_err) {
      throw new Error(
        `Network/CSP error reaching Vultr (check renderer CSP and network): ${_err instanceof Error ? _err.message : String(_err)}`
      )
    }

    if (!_response.ok) {
      throw new Error(`Vultr inference error ${_response.status}: ${await _response.text()}`)
    }

    const _data = (await _response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const _content = _data.choices?.[0]?.message?.content ?? ''
    return normalizeIntent(safeJsonParse(_content), _transcript)
  }
}
