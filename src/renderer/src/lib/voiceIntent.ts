import type { TranscriptSegment } from './speechRecognition'
import type { VoiceIntent, VoiceIntentAction } from '../stores/voiceStore'

export interface ParseIntentContext {
  readonly segments: TranscriptSegment[]
}

export interface VoiceIntentProvider {
  parseIntent: (_transcript: string, _context?: ParseIntentContext) => Promise<VoiceIntent>
}

const ALLOWED_ACTIONS: readonly VoiceIntentAction[] = [
  'open_app',
  'search_web',
  'scroll_up',
  'scroll_down',
  'click',
  'unknown'
]

function isVoiceIntentAction(_value: string): _value is VoiceIntentAction {
  return (ALLOWED_ACTIONS as readonly string[]).includes(_value)
}

function parseAction(_value: string | undefined): VoiceIntentAction {
  if (_value && isVoiceIntentAction(_value)) {
    return _value
  }
  return 'unknown'
}

const INTENT_SYSTEM_PROMPT = `You map user voice commands to JSON intents for desktop/web control.
Allowed actions: open_app, search_web, scroll_up, scroll_down, click, unknown.
Return strict JSON with this shape:
{"action":"open_app|search_web|scroll_up|scroll_down|click|unknown","query":"string?","appName":"string?","confidence":0.0}
No markdown. No extra keys.

When the input includes "Per-speaker lines" with multiple speakers, use those labels to:
- identify which line is the real command (e.g. the user request vs. backchannel like "mm-hmm", "yeah");
- if only one clear command exists, use that. If unclear, use action "unknown" with low confidence.`

function formatSegmentsForPrompt(_segments: TranscriptSegment[]): string {
  if (_segments.length === 0) {
    return ''
  }
  const _lines = _segments.map(
    (_s, _i) => `- [${_s.speakerId ?? `speaker_${_i}`}]: ${_s.text.trim()}`
  )
  return `Per-speaker lines:\n${_lines.join('\n')}\n`
}

function buildUserContent(_transcript: string, _context?: ParseIntentContext): string {
  const _diarized = _context?.segments.length ? formatSegmentsForPrompt(_context.segments) : ''
  return `${_diarized}Full transcript: "${_transcript}"

Infer the best single command JSON from the content above.`
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

function normalizeIntent(_intent: Partial<VoiceIntent> | null, _raw: string): VoiceIntent {
  if (!_intent) {
    return { action: 'unknown', confidence: 0, raw: _raw }
  }
  const _action = parseAction(typeof _intent.action === 'string' ? _intent.action : undefined)
  const _safeConfidence = Math.min(1, Math.max(0, _intent.confidence ?? 0))
  return {
    action: _action,
    query: typeof _intent.query === 'string' ? _intent.query : undefined,
    appName: typeof _intent.appName === 'string' ? _intent.appName : undefined,
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

  async parseIntent(_transcript: string, _context?: ParseIntentContext): Promise<VoiceIntent> {
    const _userContent = buildUserContent(_transcript, _context)
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
            { role: 'user', content: _userContent }
          ],
          max_tokens: 256,
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
