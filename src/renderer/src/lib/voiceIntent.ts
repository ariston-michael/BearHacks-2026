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
  'open_url',
  'open_app_with_query',
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

Allowed actions:
- open_app              -> launch an installed app by name. Use this for native apps (e.g. notepad, spotify, vscode, discord).
- open_url              -> open a specific URL in the browser. Use this for popular web services (e.g. youtube, gmail, twitter).
- open_app_with_query   -> open an app/web service AND search/type a query inside it (e.g. "open google and search for apple products", "search youtube for cat videos").
- search_web            -> generic Google search. Use when the user just wants to look something up.
- scroll_up / scroll_down -> scroll the current page.
- click                 -> click the primary button in the current view.
- unknown               -> fallback when intent is unclear or backchannel ("yeah", "ok").

Return strict JSON. Shape:
{"action":"<one of above>","query":"string?","appName":"string?","url":"string?","confidence":0.0}
No markdown, no commentary, no extra keys.

Routing rules (apply in order):
1. "open <web service>" + verb (search/look up/find) + topic  -> open_app_with_query  (appName=<service>, query=<topic>)
   Examples: "open google and search for apple products" -> {"action":"open_app_with_query","appName":"google","query":"apple products","confidence":0.9}
             "search youtube for lofi beats"             -> {"action":"open_app_with_query","appName":"youtube","query":"lofi beats","confidence":0.9}
2. "open <known web service>" with no query                  -> open_url             (url=<homepage>)
   Examples: "open youtube" -> {"action":"open_url","url":"https://www.youtube.com","confidence":0.9}
             "open gmail"   -> {"action":"open_url","url":"https://mail.google.com","confidence":0.9}
   Known web services and their homepages:
     google      -> https://www.google.com
     youtube     -> https://www.youtube.com
     gmail       -> https://mail.google.com
     google maps -> https://maps.google.com
     twitter     -> https://twitter.com
     x           -> https://x.com
     reddit      -> https://www.reddit.com
     github      -> https://github.com
     wikipedia   -> https://www.wikipedia.org
     amazon      -> https://www.amazon.com
     netflix     -> https://www.netflix.com
     spotify     -> https://open.spotify.com
     chatgpt     -> https://chat.openai.com
3. "open <app>" or "launch <app>" or "start <app>"           -> open_app            (appName=<app>)
   Examples: "open notepad"   -> {"action":"open_app","appName":"notepad","confidence":0.9}
             "launch spotify" -> {"action":"open_app","appName":"spotify","confidence":0.9}
4. "search for X" / "look up X" / "google X" (no app named) -> search_web          (query=X)
   Examples: "search for the weather in tokyo" -> {"action":"search_web","query":"weather in tokyo","confidence":0.9}
5. Scroll/click commands map to scroll_up, scroll_down, click.
6. Anything else (greetings, fillers, unclear)              -> unknown             (low confidence)

When the input includes "Per-speaker lines" with multiple speakers, use those labels to:
- identify which line is the real command (e.g. the user request vs. backchannel like "mm-hmm", "yeah");
- if only one clear command exists, use that. If unclear, use action "unknown" with low confidence.`

function formatSegmentsForPrompt(_segments: TranscriptSegment[]): string {
  if (_segments.length === 0) {
    return ''
  }
  const _lines = _segments.map((_s, _i) => {
    const _speaker = (_s.speakerId ?? `speaker_${_i}`).trim() || `speaker_${_i}`
    const _start = Number.isFinite(_s.startSec) ? _s.startSec.toFixed(2) : '0.00'
    const _end = Number.isFinite(_s.endSec) ? _s.endSec.toFixed(2) : '0.00'
    const _text = _s.text.trim().replace(/\s+/g, ' ')
    return `- [${_speaker}] (${_start}s -> ${_end}s): ${_text}`
  })
  return _lines.join('\n')
}

function buildUserContent(_transcript: string, _context?: ParseIntentContext): string {
  const _segments = _context?.segments ?? []
  const _cleanTranscript = _transcript.trim().replace(/\s+/g, ' ')
  const _payload = {
    task: 'infer_single_desktop_command',
    output_format: {
      action: 'open_app|open_url|open_app_with_query|search_web|scroll_up|scroll_down|click|unknown',
      query: 'string?',
      appName: 'string?',
      url: 'string?',
      confidence: 'number(0..1)'
    },
    transcript: _cleanTranscript,
    hasDiarizedSegments: _segments.length > 0,
    diarizedSegments:
      _segments.length > 0
        ? _segments.map((_s, _i) => ({
            speakerId: (_s.speakerId ?? `speaker_${_i}`).trim() || `speaker_${_i}`,
            startSec: Number(_s.startSec.toFixed(2)),
            endSec: Number(_s.endSec.toFixed(2)),
            text: _s.text.trim().replace(/\s+/g, ' ')
          }))
        : undefined
  }

  const _payloadJson = JSON.stringify(_payload, null, 2)
  const _segmentsText =
    _segments.length > 0 ? `\nDiarized lines (readable):\n${formatSegmentsForPrompt(_segments)}\n` : ''

  return `Input payload (JSON):
${_payloadJson}
${_segmentsText}
Use the payload above and return only one strict JSON intent object.`
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
    url: typeof _intent.url === 'string' ? _intent.url : undefined,
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
