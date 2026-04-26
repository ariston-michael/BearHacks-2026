import type { VoiceExecuteIntentPayload, VoiceExecuteIntentResult } from '../../../shared/voiceIpc'
import type { VoiceIntent } from '../stores/voiceStore'

function getScrollRoot(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-voice-scroll-root]') ?? document.documentElement
}

function scrollMain(_direction: 'up' | 'down'): void {
  const _el = getScrollRoot()
  _el.scrollBy({
    top: _direction === 'up' ? -240 : 240,
    behavior: 'smooth'
  })
}

function clickFirstMainButton(): boolean {
  const _main = document.querySelector('main')
  const _btn = _main?.querySelector<HTMLButtonElement>(
    'button:not([disabled]), [role="button"]:not([aria-disabled="true"])'
  )
  if (!_btn) {
    return false
  }
  _btn.click()
  return true
}

async function invokeMain(_payload: VoiceExecuteIntentPayload): Promise<VoiceExecuteIntentResult> {
  const _api = window.api?.voice
  if (!_api?.executeIntent) {
    return { ok: false, message: 'window.api.voice.executeIntent is not available' }
  }
  const _result = await _api.executeIntent(_payload)
  // #region agent log
  fetch('http://127.0.0.1:7571/ingest/fa9108c5-730f-4e3a-a373-dbb935263b74',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b555ed'},body:JSON.stringify({sessionId:'b555ed',runId:'initial',hypothesisId:'H3,H4',location:'src/renderer/src/lib/voiceActionDispatcher.ts:invokeMain',message:'Main IPC returned',data:{action:_payload.action,confidence:_payload.confidence,linkIndex:_payload.linkIndex,hasLinkText:Boolean(_payload.linkText?.trim()),ok:_result.ok,message:_result.message},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
  return _result
}

/**
 * Runs the intent: main process for search/open_app; renderer for scroll/click.
 */
export async function dispatchVoiceIntent(_intent: VoiceIntent): Promise<VoiceExecuteIntentResult> {
  // #region agent log
  fetch('http://127.0.0.1:7571/ingest/fa9108c5-730f-4e3a-a373-dbb935263b74',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'75ef5f'},body:JSON.stringify({sessionId:'75ef5f',runId:'initial',hypothesisId:'H2',location:'src/renderer/src/lib/voiceActionDispatcher.ts:dispatchVoiceIntent',message:'Renderer dispatch evaluated',data:{action:_intent.action,confidence:_intent.confidence,willStopAsUnknown:_intent.action==='unknown',hasLinkIndex:_intent.linkIndex!==undefined,hasLinkText:Boolean(_intent.linkText?.trim()),hasTargetIndex:_intent.targetIndex!==undefined,hasTargetText:Boolean(_intent.targetText?.trim()),targetKind:_intent.targetKind},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
  const _payload: VoiceExecuteIntentPayload = {
    action: _intent.action,
    query: _intent.query,
    appName: _intent.appName,
    url: _intent.url,
    linkIndex: _intent.linkIndex,
    linkText: _intent.linkText,
    anchorText: _intent.anchorText,
    targetIndex: _intent.targetIndex,
    targetText: _intent.targetText,
    targetKind: _intent.targetKind,
    confidence: _intent.confidence
  }

  switch (_intent.action) {
    case 'search_web':
      if (!_intent.query?.trim()) {
        return { ok: false, message: 'search_web requires query' }
      }
      return invokeMain(_payload)
    case 'open_app':
      if (!_intent.appName?.trim()) {
        return { ok: false, message: 'open_app requires appName' }
      }
      return invokeMain(_payload)
    case 'open_url':
      if (!_intent.url?.trim()) {
        return { ok: false, message: 'open_url requires url' }
      }
      return invokeMain(_payload)
    case 'open_app_with_query':
      if (!_intent.appName?.trim() || !_intent.query?.trim()) {
        return { ok: false, message: 'open_app_with_query requires appName and query' }
      }
      return invokeMain(_payload)
    case 'select_link':
      if (_intent.linkIndex === undefined && !_intent.linkText?.trim()) {
        return { ok: false, message: 'select_link requires linkIndex or linkText' }
      }
      return invokeMain(_payload)
    case 'page_question':
      if (!_intent.query?.trim() && !_intent.anchorText?.trim()) {
        return { ok: false, message: 'page_question requires query or anchorText' }
      }
      return invokeMain(_payload)
    case 'spotify_search':
      if (!_intent.query?.trim()) {
        return { ok: false, message: 'spotify_search requires query' }
      }
      return invokeMain(_payload)
    case 'spotify_select':
      if (_intent.targetIndex === undefined && !_intent.targetText?.trim()) {
        return { ok: false, message: 'spotify_select requires targetIndex or targetText' }
      }
      return invokeMain(_payload)
    case 'scroll_up':
      scrollMain('up')
      return { ok: true, message: 'Scrolled up' }
    case 'scroll_down':
      scrollMain('down')
      return { ok: true, message: 'Scrolled down' }
    case 'click': {
      const _did = clickFirstMainButton()
      return _did
        ? { ok: true, message: 'Clicked first button in main content' }
        : { ok: false, message: 'No clickable button found in main' }
    }
    case 'unknown':
      return invokeMain(_payload)
    default:
      return { ok: false, message: 'Unhandled action' }
  }
}
