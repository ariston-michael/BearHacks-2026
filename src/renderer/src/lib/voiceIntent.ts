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
  'select_link',
  'page_question',
  'spotify_search',
  'spotify_select',
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
- select_link           -> select/click a visible link in the current Chrome tab by ordinal or spoken link text.
- page_question         -> answer a question from the current visible web page content (recipes, ingredients, sections, text order).
- spotify_search        -> search inside the native Spotify app for music, albums, artists, podcasts, or playlists.
- spotify_select        -> select/play/click a visible Spotify result by name, type, or ordinal.
- scroll_up / scroll_down -> scroll the current page.
- click                 -> click the primary button in the current view.
- unknown               -> fallback when intent is unclear or backchannel ("yeah", "ok").

Return strict JSON. Shape:
{"action":"<one of above>","query":"string?","appName":"string?","url":"string?","linkIndex":1,"linkText":"string?","anchorText":"string?","targetIndex":1,"targetText":"string?","targetKind":"song|album|podcast|artist|playlist|unknown","confidence":0.0}
No markdown, no commentary, no extra keys.
Prefer a concrete supported action whenever the transcript contains a recognizable command. Use unknown only for filler, backchannel, silence, or truly ambiguous speech.

Routing rules (apply in order):
1. Follow-up browser link selection by ordinal or visible text     -> select_link
   Examples: "check the first link" -> {"action":"select_link","linkIndex":1,"confidence":0.9}
             "open the link that says Wikipedia" -> {"action":"select_link","linkText":"Wikipedia","confidence":0.9}
2. Questions about the current web page/recipe/text order          -> page_question
   Examples: "what comes after flour" -> {"action":"page_question","query":"what comes after flour","anchorText":"flour","confidence":0.9}
             "what is the next ingredient after sugar" -> {"action":"page_question","query":"what is the next ingredient after sugar","anchorText":"sugar","confidence":0.9}
3. Spotify-specific search/select/play commands                    -> spotify_search or spotify_select
   Examples: "search Spotify for Daft Punk" -> {"action":"spotify_search","query":"Daft Punk","confidence":0.9}
             "play the song named One More Time" -> {"action":"spotify_select","targetText":"One More Time","targetKind":"song","confidence":0.9}
             "click the second album" -> {"action":"spotify_select","targetIndex":2,"targetKind":"album","confidence":0.85}
4. "open <web service>" + verb (search/look up/find) + topic  -> open_app_with_query  (appName=<service>, query=<topic>)
   Examples: "open google and search for apple products" -> {"action":"open_app_with_query","appName":"google","query":"apple products","confidence":0.9}
             "search youtube for lofi beats"             -> {"action":"open_app_with_query","appName":"youtube","query":"lofi beats","confidence":0.9}
5. "open <known web service>" with no query                  -> open_url             (url=<homepage>)
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
6. "open <app>" or "launch <app>" or "start <app>"           -> open_app            (appName=<app>)
   Examples: "open notepad"   -> {"action":"open_app","appName":"notepad","confidence":0.9}
             "launch spotify" -> {"action":"open_app","appName":"spotify","confidence":0.9}
7. "search for X" / "look up X" / "google X" (no app named) -> search_web          (query=X)
   Examples: "search for the weather in tokyo" -> {"action":"search_web","query":"weather in tokyo","confidence":0.9}
8. Scroll/click commands map to scroll_up, scroll_down, click.
9. Elliptical / shortcut phrases (no verb, terse). Treat these as concrete actions, not unknown:
   - Bare known app/service name (1-3 words) -> open_app (the host resolver will pick the installed app or homepage).
     Examples: "spotify"   -> {"action":"open_app","appName":"spotify","confidence":0.85}
               "notepad"   -> {"action":"open_app","appName":"notepad","confidence":0.85}
               "discord"   -> {"action":"open_app","appName":"discord","confidence":0.85}
               "youtube"   -> {"action":"open_url","url":"https://www.youtube.com","confidence":0.85}
               "google maps" -> {"action":"open_url","url":"https://maps.google.com","confidence":0.85}
   - "link <text>" / "click link <text>" / "<ordinal> link" / "<ordinal> one"  -> select_link
     Examples: "link cookies"   -> {"action":"select_link","linkText":"cookies","confidence":0.85}
               "first link"     -> {"action":"select_link","linkIndex":1,"confidence":0.85}
               "third one"      -> {"action":"select_link","linkIndex":3,"confidence":0.8}
               "click link wikipedia" -> {"action":"select_link","linkText":"wikipedia","confidence":0.9}
   - Bare topical phrase (no verb, not a known app) -> search_web with the phrase as query.
     Examples: "cookie recipes" -> {"action":"search_web","query":"cookie recipes","confidence":0.7}
               "weather tokyo"  -> {"action":"search_web","query":"weather tokyo","confidence":0.7}
10. Anything else (greetings, fillers, unclear)             -> unknown             (low confidence)

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
      action:
        'open_app|open_url|open_app_with_query|search_web|select_link|page_question|spotify_search|spotify_select|scroll_up|scroll_down|click|unknown',
      query: 'string?',
      appName: 'string?',
      url: 'string?',
      linkIndex: 'number?',
      linkText: 'string?',
      anchorText: 'string?',
      targetIndex: 'number?',
      targetText: 'string?',
      targetKind: 'song|album|podcast|artist|playlist|unknown?',
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
    linkIndex: typeof _intent.linkIndex === 'number' ? _intent.linkIndex : undefined,
    linkText: typeof _intent.linkText === 'string' ? _intent.linkText : undefined,
    anchorText: typeof _intent.anchorText === 'string' ? _intent.anchorText : undefined,
    targetIndex: typeof _intent.targetIndex === 'number' ? _intent.targetIndex : undefined,
    targetText: typeof _intent.targetText === 'string' ? _intent.targetText : undefined,
    targetKind: typeof _intent.targetKind === 'string' ? _intent.targetKind : undefined,
    confidence: _safeConfidence,
    raw: _raw
  }
}

function cleanupQuery(_query: string): string {
  return _query
    .trim()
    .replace(/^[.,;:\s]+/g, '')
    .replace(/[.?!,;:\s]+$/g, '')
    .replace(/\s+/g, ' ')
}

const ORDINAL_TO_INDEX: Record<string, number> = {
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
  sixth: 6,
  seventh: 7,
  eighth: 8,
  ninth: 9,
  tenth: 10
}

function ordinalToIndex(_token: string): number | null {
  const _key = _token.toLowerCase().trim()
  if (_key in ORDINAL_TO_INDEX) {
    return ORDINAL_TO_INDEX[_key]
  }
  const _digits = _key.replace(/(?:st|nd|rd|th)$/g, '')
  const _num = Number.parseInt(_digits, 10)
  return Number.isFinite(_num) && _num > 0 ? _num : null
}

const SEARCH_TARGET_HOSTS = new Set([
  'youtube',
  'google',
  'amazon',
  'reddit',
  'github',
  'wikipedia',
  'spotify'
])

/**
 * Names the local fallback recognises as a bare app or web-service utterance.
 * The main resolver in `voiceCommands.ts` will still decide between launching
 * an installed app and opening a homepage; we just need to route as `open_app`.
 */
const KNOWN_APP_TOKENS = new Set<string>([
  'spotify',
  'youtube',
  'gmail',
  'google',
  'google maps',
  'maps',
  'twitter',
  'reddit',
  'github',
  'wikipedia',
  'amazon',
  'netflix',
  'chatgpt',
  'chat gpt',
  'discord',
  'slack',
  'notepad',
  'notepad++',
  'calculator',
  'paint',
  'word',
  'excel',
  'powerpoint',
  'outlook',
  'teams',
  'zoom',
  'chrome',
  'edge',
  'firefox',
  'brave',
  'opera',
  'safari',
  'vscode',
  'visual studio code',
  'code',
  'visual studio',
  'terminal',
  'cmd',
  'powershell',
  'file explorer',
  'explorer',
  'settings',
  'control panel',
  'task manager',
  'steam',
  'epic games',
  'obs',
  'figma',
  'photoshop',
  'illustrator'
])

interface LocalInferResult {
  intent: VoiceIntent
  /** Short tag for debug logging, e.g. "link-text", "app-bare". */
  tag: string
}

function makeLocalIntent(
  _partial: Omit<VoiceIntent, 'raw'>,
  _transcript: string,
  _tag: string
): LocalInferResult {
  return {
    intent: { ..._partial, raw: `local-fallback:${_tag}:${_transcript}` },
    tag: _tag
  }
}

function inferLinkIntent(_transcript: string): LocalInferResult | null {
  const _verbOrdinal = _transcript.match(
    /^(?:click|open|select|tap|check|pick|choose)\s+(?:on\s+)?(?:the\s+)?(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th)?)\s+(?:link|result|one)$/i
  )
  if (_verbOrdinal) {
    const _idx = ordinalToIndex(_verbOrdinal[1])
    if (_idx !== null) {
      return makeLocalIntent(
        { action: 'select_link', linkIndex: _idx, confidence: 0.85 },
        _transcript,
        'link-ordinal-verb'
      )
    }
  }

  const _bareOrdinal = _transcript.match(
    /^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th)?)\s+(?:link|result|one)$/i
  )
  if (_bareOrdinal) {
    const _idx = ordinalToIndex(_bareOrdinal[1])
    if (_idx !== null) {
      return makeLocalIntent(
        { action: 'select_link', linkIndex: _idx, confidence: 0.85 },
        _transcript,
        'link-ordinal-bare'
      )
    }
  }

  const _verbLink = _transcript.match(
    /^(?:click|open|select|tap|check|pick|choose)\s+(?:on\s+)?(?:the\s+)?link\s+(?:that\s+says\s+|named\s+|called\s+)?(.+)$/i
  )
  if (_verbLink) {
    const _text = cleanupQuery(_verbLink[1])
    if (_text.length > 0) {
      return makeLocalIntent(
        { action: 'select_link', linkText: _text, confidence: 0.9 },
        _transcript,
        'link-verb-text'
      )
    }
  }

  const _bareLink = _transcript.match(/^link\s+(.+)$/i)
  if (_bareLink) {
    const _text = cleanupQuery(_bareLink[1])
    const _idx = ordinalToIndex(_text)
    if (_idx !== null) {
      return makeLocalIntent(
        { action: 'select_link', linkIndex: _idx, confidence: 0.85 },
        _transcript,
        'link-bare-ordinal'
      )
    }
    if (_text.length > 0) {
      return makeLocalIntent(
        { action: 'select_link', linkText: _text, confidence: 0.85 },
        _transcript,
        'link-bare-text'
      )
    }
  }

  return null
}

function inferAppIntent(_transcript: string): LocalInferResult | null {
  const _verbApp = _transcript.match(
    /^(?:open|launch|start|run|fire\s+up|boot|bring\s+up)\s+(?:the\s+)?(.+)$/i
  )
  if (_verbApp) {
    const _name = cleanupQuery(_verbApp[1])
    if (_name.length > 0) {
      return makeLocalIntent(
        { action: 'open_app', appName: _name, confidence: 0.85 },
        _transcript,
        'app-verb'
      )
    }
  }

  const _normalised = cleanupQuery(_transcript).toLowerCase()
  if (KNOWN_APP_TOKENS.has(_normalised)) {
    return makeLocalIntent(
      { action: 'open_app', appName: _normalised, confidence: 0.8 },
      _transcript,
      'app-bare'
    )
  }

  return null
}

function inferSearchIntent(_transcript: string): LocalInferResult | null {
  const _onSite = _transcript.match(
    /^(?:please\s+)?(?:search|look\s+up|find)\s+(.+?)\s+(?:on|in|at)\s+(youtube|google|amazon|reddit|github|wikipedia|spotify)$/i
  )
  if (_onSite) {
    const _query = cleanupQuery(_onSite[1])
    const _site = _onSite[2].toLowerCase()
    if (_query.length > 0 && SEARCH_TARGET_HOSTS.has(_site)) {
      return makeLocalIntent(
        { action: 'open_app_with_query', appName: _site, query: _query, confidence: 0.85 },
        _transcript,
        'search-on-site'
      )
    }
  }

  const _verbSearch = _transcript.match(
    /^(?:please\s+)?(?:search(?:\s+(?:for|up))?|look\s+up|google|find|what\s+is|who\s+is|tell\s+me\s+about)\s+(.+)$/i
  )
  if (_verbSearch) {
    const _query = cleanupQuery(_verbSearch[1])
    if (_query.length > 0) {
      return makeLocalIntent(
        { action: 'search_web', query: _query, confidence: 0.8 },
        _transcript,
        'search-verb'
      )
    }
  }

  return null
}

function inferLocalIntentFromTranscript(_transcript: string): LocalInferResult | null {
  const _clean = cleanupQuery(_transcript)
  if (_clean.length === 0) {
    return null
  }

  return inferLinkIntent(_clean) ?? inferAppIntent(_clean) ?? inferSearchIntent(_clean)
}

function hasRequiredFields(_intent: VoiceIntent): boolean {
  switch (_intent.action) {
    case 'search_web':
      return Boolean(_intent.query?.trim())
    case 'open_app':
    case 'open_app_with_query':
      return Boolean(_intent.appName?.trim())
    case 'open_url':
      return Boolean(_intent.url?.trim())
    case 'select_link':
      return _intent.linkIndex !== undefined || Boolean(_intent.linkText?.trim())
    case 'page_question':
      return Boolean(_intent.query?.trim()) || Boolean(_intent.anchorText?.trim())
    case 'spotify_search':
      return Boolean(_intent.query?.trim())
    case 'spotify_select':
      return _intent.targetIndex !== undefined || Boolean(_intent.targetText?.trim())
    case 'scroll_up':
    case 'scroll_down':
    case 'click':
      return true
    case 'unknown':
      return false
    default:
      return false
  }
}

// ---------------------------------------------------------------------------
// Vultr Serverless Inference provider (Gemma 4)
// ---------------------------------------------------------------------------

const VULTR_INFERENCE_ENDPOINT = 'https://api.vultrinference.com/v1/chat/completions'
const VULTR_GEMMA_MODEL = 'gemma-4-26B-A4B-it'

export class VultrGemmaIntentProvider implements VoiceIntentProvider {
  private readonly m_numChecks: number

  constructor(_apiKey: string, _numChecks: number = 3) {
    this.m_apiKey = _apiKey
    this.m_numChecks = Math.max(1, _numChecks)
  }

  private readonly m_apiKey: string

  private async m_singleCheck(_userContent: string, _transcript: string): Promise<VoiceIntent> {
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
    const _parsed = safeJsonParse(_content)
    return normalizeIntent(_parsed, _content)
  }

  async parseIntent(_transcript: string, _context?: ParseIntentContext): Promise<VoiceIntent> {
    const _userContent = buildUserContent(_transcript, _context)

    const _checks = Array.from({ length: this.m_numChecks }, () =>
      this.m_singleCheck(_userContent, _transcript).catch(
        (_err): VoiceIntent => ({ action: 'unknown', confidence: 0, raw: String(_err) })
      )
    )

    const _results = await Promise.all(_checks)

    const _best = _results.reduce((_a, _b) => (_b.confidence > _a.confidence ? _b : _a))
    const _bestCompleteConcreteIntent = _results
      .filter((_result) => _result.action !== 'unknown' && hasRequiredFields(_result))
      .reduce<VoiceIntent | null>(
        (_bestValid, _candidate) =>
          !_bestValid || _candidate.confidence > _bestValid.confidence ? _candidate : _bestValid,
        null
      )
    const _localFallback = _bestCompleteConcreteIntent
      ? null
      : inferLocalIntentFromTranscript(_transcript)
    const _selected = _bestCompleteConcreteIntent ?? _localFallback?.intent ?? _best
    const _selectedReason = _bestCompleteConcreteIntent
      ? 'concrete-with-fields'
      : _localFallback
        ? `local-fallback:${_localFallback.tag}`
        : 'best-overall'

    // #region agent log
    fetch('http://127.0.0.1:7571/ingest/fa9108c5-730f-4e3a-a373-dbb935263b74',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b555ed'},body:JSON.stringify({sessionId:'b555ed',runId:'initial',hypothesisId:'H1,H2',location:'src/renderer/src/lib/voiceIntent.ts:parseIntent',message:'Gemma multi-check results',data:{transcriptLength:_transcript.length,transcriptPrefix:_transcript.slice(0,120),segmentCount:_context?.segments.length??0,numChecks:this.m_numChecks,results:_results.map(_r=>({action:_r.action,confidence:_r.confidence,rawPrefix:_r.raw.slice(0,180),hasQuery:Boolean(_r.query?.trim()),hasAppName:Boolean(_r.appName?.trim()),hasRequiredFields:hasRequiredFields(_r)})),bestAction:_best.action,bestConfidence:_best.confidence,selectedAction:_selected.action,selectedConfidence:_selected.confidence,selectedReason:_selectedReason},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    // #region agent log
    fetch('http://127.0.0.1:7571/ingest/fa9108c5-730f-4e3a-a373-dbb935263b74',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'75ef5f'},body:JSON.stringify({sessionId:'75ef5f',runId:'initial',hypothesisId:'H1',location:'src/renderer/src/lib/voiceIntent.ts:parseIntent',message:'Gemma intent normalized',data:{transcriptLength:_transcript.length,contentPrefix:_selected.raw.slice(0,180),normalizedAction:_selected.action,hasLinkIndex:_selected.linkIndex!==undefined,hasLinkText:Boolean(_selected.linkText?.trim()),hasTargetIndex:_selected.targetIndex!==undefined,hasTargetText:Boolean(_selected.targetText?.trim()),targetKind:_selected.targetKind,confidence:_selected.confidence,selectedReason:_selectedReason},timestamp:Date.now()})}).catch(()=>{})
    // #endregion

    return _selected
  }
}
