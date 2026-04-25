import type { VoiceIntent } from '../stores/voiceStore'

export interface VoiceIntentProvider {
  parseIntent: (_transcript: string) => Promise<VoiceIntent>
}

const INTENT_SYSTEM_PROMPT = `
You map user voice commands to JSON intents for desktop/web control.
Allowed actions: open_app, search_web, scroll_up, scroll_down, click, unknown.
Return strict JSON with this shape:
{"action":"open_app|search_web|scroll_up|scroll_down|click|unknown","query":"string?","appName":"string?","confidence":0.0}
No markdown. No extra keys.
`

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

function normalizeIntent(_intent: Partial<VoiceIntent> | null, _raw: string): VoiceIntent {
  if (!_intent) {
    return { action: 'unknown', confidence: 0, raw: _raw }
  }
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

// ---------------------------------------------------------------------------
// Vultr Serverless Inference provider (Gemma 4)
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
    const _content = _data.choices?.[0]?.message?.content?.trim() ?? ''
    return normalizeIntent(safeJsonParse(_content), _content)
  }
}
