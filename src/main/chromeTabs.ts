import Fuse from 'fuse.js'
import { writeAgentDebugLog } from './agentDebugLog'

export const CHROME_DEBUG_PORT = 9224

interface ChromeTabDescriptor {
  id: string
  title: string
  type: string
  url: string
  webSocketDebuggerUrl?: string
}

interface CdpResponse<T> {
  id: number
  result?: T
  error?: { message?: string }
}

interface RuntimeEvaluateResult<T> {
  result?: {
    value?: T
    description?: string
  }
  exceptionDetails?: unknown
}

export interface VisibleChromeLink {
  index: number
  text: string
  href: string
  title?: string
  ariaLabel?: string
  top: number
  left: number
}

interface LinkSnapshot {
  title: string
  url: string
  links: VisibleChromeLink[]
}

interface PageTextSnapshot {
  title: string
  url: string
  text: string
}

class CdpClient {
  private m_nextId = 1
  private readonly m_pending = new Map<number, (value: CdpResponse<unknown>) => void>()
  private readonly m_socket: WebSocket

  private constructor(_socket: WebSocket) {
    this.m_socket = _socket
    this.m_socket.addEventListener('message', (_event) => {
      const _message = JSON.parse(String(_event.data)) as CdpResponse<unknown>
      if (typeof _message.id !== 'number') {
        return
      }
      const _resolve = this.m_pending.get(_message.id)
      if (_resolve) {
        this.m_pending.delete(_message.id)
        _resolve(_message)
      }
    })
  }

  static connect(_url: string): Promise<CdpClient> {
    return new Promise((_resolve, _reject) => {
      const _socket = new WebSocket(_url)
      _socket.addEventListener('open', () => _resolve(new CdpClient(_socket)))
      _socket.addEventListener('error', () => _reject(new Error('Chrome DevTools WebSocket failed')))
    })
  }

  async send<T>(_method: string, _params: Record<string, unknown> = {}): Promise<T> {
    const _id = this.m_nextId++
    const _response = await new Promise<CdpResponse<T>>((_resolve) => {
      this.m_pending.set(_id, _resolve as (value: CdpResponse<unknown>) => void)
      this.m_socket.send(JSON.stringify({ id: _id, method: _method, params: _params }))
    })
    if (_response.error) {
      throw new Error(_response.error.message ?? `Chrome DevTools command failed: ${_method}`)
    }
    return _response.result as T
  }

  async evaluate<T>(_expression: string): Promise<T> {
    const _result = await this.send<RuntimeEvaluateResult<T>>('Runtime.evaluate', {
      expression: _expression,
      awaitPromise: true,
      returnByValue: true
    })
    if (_result.exceptionDetails) {
      throw new Error('Chrome page evaluation failed')
    }
    return _result.result?.value as T
  }

  close(): void {
    this.m_socket.close()
  }
}

function jsString(_value: string): string {
  return JSON.stringify(_value)
}

async function getInspectableTabs(): Promise<ChromeTabDescriptor[]> {
  // #region agent log
  writeAgentDebugLog('followup','H7','src/main/chromeTabs.ts:getInspectableTabs','Chrome DevTools tab fetch starting',{port:CHROME_DEBUG_PORT})
  // #endregion
  let _response: Response
  try {
    _response = await fetch(`http://127.0.0.1:${CHROME_DEBUG_PORT}/json/list`)
  } catch (_err) {
    // #region agent log
    writeAgentDebugLog('followup','H7','src/main/chromeTabs.ts:getInspectableTabs','Chrome DevTools tab fetch failed',{port:CHROME_DEBUG_PORT,error:_err instanceof Error ? _err.message : String(_err)})
    // #endregion
    throw _err
  }
  // #region agent log
  writeAgentDebugLog('initial','H3','src/main/chromeTabs.ts:getInspectableTabs','Chrome DevTools tab list response',{ok:_response.ok,status:_response.status,port:CHROME_DEBUG_PORT})
  // #endregion
  if (!_response.ok) {
    throw new Error(`Chrome DevTools is not reachable on port ${CHROME_DEBUG_PORT}`)
  }
  const _tabs = (await _response.json()) as ChromeTabDescriptor[]
  // #region agent log
  writeAgentDebugLog('initial','H3','src/main/chromeTabs.ts:getInspectableTabs','Chrome DevTools tabs discovered',{tabCount:_tabs.length,pageCount:_tabs.filter((_tab)=>_tab.type==='page').length,hosts:_tabs.slice(0,5).map((_tab)=>{try{return new URL(_tab.url).host}catch{return _tab.url.slice(0,40)}})})
  // #endregion
  return _tabs
}

async function withCurrentPage<T>(_fn: (_client: CdpClient) => Promise<T>): Promise<T> {
  const _tabs = await getInspectableTabs()
  const _page =
    _tabs.find((_tab) => _tab.type === 'page' && /^https?:\/\//i.test(_tab.url)) ??
    _tabs.find((_tab) => _tab.type === 'page')
  // #region agent log
  writeAgentDebugLog('followup','H8,H9','src/main/chromeTabs.ts:withCurrentPage','Chrome current page candidate selected',{tabCount:_tabs.length,pageCount:_tabs.filter((_tab)=>_tab.type==='page').length,selectedTitle:_page?.title,selectedUrlHost:(()=>{try{return _page?.url?new URL(_page.url).host:null}catch{return 'invalid-url'}})(),selectedType:_page?.type,hasWebSocket:Boolean(_page?.webSocketDebuggerUrl)})
  fetch('http://127.0.0.1:7571/ingest/fa9108c5-730f-4e3a-a373-dbb935263b74',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b555ed'},body:JSON.stringify({sessionId:'b555ed',runId:'initial',hypothesisId:'H3',location:'src/main/chromeTabs.ts:withCurrentPage',message:'Chrome current page selected',data:{tabCount:_tabs.length,pageCount:_tabs.filter((_tab)=>_tab.type==='page').length,selectedTitle:_page?.title,selectedUrlHost:(()=>{try{return _page?.url?new URL(_page.url).host:null}catch{return 'invalid-url'}})(),selectedType:_page?.type,hasWebSocket:Boolean(_page?.webSocketDebuggerUrl)},timestamp:Date.now()})}).catch(()=>{})
  // #endregion
  if (!_page?.webSocketDebuggerUrl) {
    throw new Error('No inspectable Chrome page tab is available')
  }
  const _client = await CdpClient.connect(_page.webSocketDebuggerUrl)
  try {
    return await _fn(_client)
  } finally {
    _client.close()
  }
}

const LINK_SNAPSHOT_EXPRESSION = `(() => {
  const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim()
  const isVisible = (el) => {
    const style = window.getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    return style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom >= 0 &&
      rect.right >= 0 &&
      rect.top <= window.innerHeight &&
      rect.left <= window.innerWidth
  }
  const links = []
  const seen = new Set()
  for (const anchor of Array.from(document.querySelectorAll('a[href]'))) {
    if (!isVisible(anchor)) continue
    const href = anchor.href
    if (!href || href.startsWith('javascript:')) continue
    const text = normalize(anchor.innerText || anchor.textContent || anchor.getAttribute('aria-label') || anchor.title)
    if (!text) continue
    const rect = anchor.getBoundingClientRect()
    const key = href + '|' + text.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    links.push({
      index: links.length + 1,
      text,
      href,
      title: normalize(anchor.title),
      ariaLabel: normalize(anchor.getAttribute('aria-label')),
      top: Math.round(rect.top),
      left: Math.round(rect.left)
    })
  }
  links.sort((a, b) => a.top - b.top || a.left - b.left)
  return {
    title: document.title,
    url: location.href,
    links: links.slice(0, 80).map((link, index) => ({ ...link, index: index + 1 }))
  }
})()`

const PAGE_TEXT_EXPRESSION = `(() => ({
  title: document.title,
  url: location.href,
  text: String(document.body?.innerText || '').replace(/\\n{3,}/g, '\\n\\n').trim().slice(0, 60000)
}))()`

export async function getCurrentPageText(): Promise<PageTextSnapshot> {
  return withCurrentPage((_client) => _client.evaluate<PageTextSnapshot>(PAGE_TEXT_EXPRESSION))
}

export async function selectVisibleLink(
  _linkIndex?: number,
  _linkText?: string
): Promise<{ link: VisibleChromeLink; pageTitle: string }> {
  return withCurrentPage(async (_client) => {
    const _snapshot = await _client.evaluate<LinkSnapshot>(LINK_SNAPSHOT_EXPRESSION)
    // #region agent log
    writeAgentDebugLog('initial','H4','src/main/chromeTabs.ts:selectVisibleLink','Visible Chrome link snapshot',{pageHost:(()=>{try{return new URL(_snapshot.url).host}catch{return 'unknown'}})(),linkCount:_snapshot.links.length,requestedIndex:_linkIndex,hasRequestedText:Boolean(_linkText?.trim()),firstLinks:_snapshot.links.slice(0,5).map((_link)=>({index:_link.index,textLength:_link.text.length,host:(()=>{try{return new URL(_link.href).host}catch{return 'unknown'}})()}))})
    // #endregion
    const _link = chooseLink(_snapshot.links, _linkIndex, _linkText)
    if (!_link) {
      throw new Error(_linkText ? `No visible link matched "${_linkText}"` : 'No visible link matched')
    }
    const _clicked = await _client.evaluate<boolean>(`(() => {
      const normalize = (value) => String(value || '').replace(/\\s+/g, ' ').trim()
      const expectedHref = ${jsString(_link.href)}
      const expectedText = ${jsString(_link.text)}
      const links = Array.from(document.querySelectorAll('a[href]'))
      const anchor = links.find((candidate) =>
        candidate.href === expectedHref &&
        normalize(candidate.innerText || candidate.textContent || candidate.getAttribute('aria-label') || candidate.title) === expectedText
      ) || links.find((candidate) => candidate.href === expectedHref)
      if (!anchor) return false
      anchor.scrollIntoView({ block: 'center', inline: 'center' })
      anchor.click()
      return true
    })()`)
    // #region agent log
    fetch('http://127.0.0.1:7571/ingest/fa9108c5-730f-4e3a-a373-dbb935263b74',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b555ed'},body:JSON.stringify({sessionId:'b555ed',runId:'initial',hypothesisId:'H3,H4',location:'src/main/chromeTabs.ts:selectVisibleLink',message:'Chrome link click evaluated',data:{clicked:_clicked,selectedIndex:_link.index,selectedTextLength:_link.text.length,selectedHrefHost:(()=>{try{return new URL(_link.href).host}catch{return 'invalid-url'}})(),pageTitle:_snapshot.title,pageUrlHost:(()=>{try{return new URL(_snapshot.url).host}catch{return 'invalid-url'}})(),linkCount:_snapshot.links.length},timestamp:Date.now()})}).catch(()=>{})
    // #endregion
    if (!_clicked) {
      throw new Error(`Could not click visible link "${_link.text}"`)
    }
    // #region agent log
    writeAgentDebugLog('initial','H4','src/main/chromeTabs.ts:selectVisibleLink','Chrome link click completed',{clicked:true,selectedIndex:_link.index,selectedTextLength:_link.text.length,selectedHost:(()=>{try{return new URL(_link.href).host}catch{return 'unknown'}})()})
    // #endregion
    return { link: _link, pageTitle: _snapshot.title }
  })
}

function chooseLink(
  _links: VisibleChromeLink[],
  _linkIndex?: number,
  _linkText?: string
): VisibleChromeLink | null {
  if (_linkIndex !== undefined) {
    return _links[_linkIndex - 1] ?? null
  }
  const _query = _linkText?.trim()
  if (!_query) {
    return null
  }
  const _fuse = new Fuse(_links, {
    keys: ['text', 'title', 'ariaLabel', 'href'],
    threshold: 0.35,
    ignoreLocation: true,
    includeScore: true
  })
  return _fuse.search(_query, { limit: 1 })[0]?.item ?? null
}
