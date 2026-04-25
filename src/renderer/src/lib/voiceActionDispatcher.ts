import type { VoiceExecuteIntentPayload, VoiceExecuteIntentResult } from '../../../shared/voiceIpc'
import type { VoiceIntent } from '../stores/voiceStore'

const MIN_CONFIDENCE = 0.28

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
  return _api.executeIntent(_payload)
}

/**
 * Runs the intent: main process for search/open_app; renderer for scroll/click.
 */
export async function dispatchVoiceIntent(_intent: VoiceIntent): Promise<VoiceExecuteIntentResult> {
  if (_intent.action === 'unknown') {
    return { ok: false, message: 'No action (intent is unknown)' }
  }
  if (_intent.confidence < MIN_CONFIDENCE) {
    return {
      ok: false,
      message: `Skipped: confidence ${_intent.confidence.toFixed(2)} below threshold ${MIN_CONFIDENCE}`
    }
  }

  const _payload: VoiceExecuteIntentPayload = {
    action: _intent.action,
    query: _intent.query,
    appName: _intent.appName,
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
    default:
      return { ok: false, message: 'Unhandled action' }
  }
}
