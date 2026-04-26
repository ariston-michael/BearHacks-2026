import * as fsPromises from 'node:fs/promises'
import * as nodePath from 'node:path'

const AGENT_DEBUG_LOG_PATH = nodePath.join(process.cwd(), 'debug-75ef5f.log')
const CURRENT_DEBUG_LOG_PATH = nodePath.join(process.cwd(), 'debug-b555ed.log')
const AGENT_DEBUG_ENDPOINT = 'http://127.0.0.1:7571/ingest/fa9108c5-730f-4e3a-a373-dbb935263b74'

export function writeAgentDebugLog(
  _runId: string,
  _hypothesisId: string,
  _location: string,
  _message: string,
  _data: Record<string, unknown>
): void {
  const _payload = {
    sessionId: '75ef5f',
    runId: _runId,
    hypothesisId: _hypothesisId,
    location: _location,
    message: _message,
    data: _data,
    timestamp: Date.now()
  }
  const _currentPayload = { ..._payload, sessionId: 'b555ed' }
  void fsPromises.appendFile(AGENT_DEBUG_LOG_PATH, `${JSON.stringify(_payload)}\n`).catch(() => {})
  // #region agent log
  void fsPromises.appendFile(CURRENT_DEBUG_LOG_PATH, `${JSON.stringify(_currentPayload)}\n`).catch(() => {})
  // #endregion
  void fetch(AGENT_DEBUG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '75ef5f' },
    body: JSON.stringify(_payload)
  }).catch(() => {})
}
