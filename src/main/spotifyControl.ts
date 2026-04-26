import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { shell } from 'electron'
import Fuse from 'fuse.js'
import { keyboard, Key, mouse } from '@nut-tree-fork/nut-js'
import { getInstalledApps, type DiscoveredApp } from './appDiscovery'
import { writeAgentDebugLog } from './agentDebugLog'
import type { SpotifyTargetKind } from '../shared/voiceIpc'

const _execFileAsync = promisify(execFile)

function delay(_ms: number): Promise<void> {
  return new Promise((_resolve) => setTimeout(_resolve, _ms))
}

function getKey(_candidates: string[]): Key {
  const _keyMap = Key as unknown as Record<string, Key>
  for (const _candidate of _candidates) {
    const _key = _keyMap[_candidate]
    if (_key !== undefined) {
      return _key
    }
  }
  throw new Error(`Missing keyboard key mapping: ${_candidates.join('/')}`)
}

async function pressShortcut(..._keys: Key[]): Promise<void> {
  await keyboard.pressKey(..._keys)
  await keyboard.releaseKey(..._keys.reverse())
}

async function findSpotifyApp(): Promise<DiscoveredApp | null> {
  const _apps = await getInstalledApps()
  const _fuse = new Fuse(_apps, {
    keys: ['name'],
    threshold: 0.35,
    ignoreLocation: true,
    shouldSort: true
  })
  return _fuse.search('spotify', { limit: 1 })[0]?.item ?? null
}

async function launchDiscoveredApp(_app: DiscoveredApp): Promise<void> {
  if (_app.kind === 'shortcut') {
    const _err = await shell.openPath(_app.target)
    if (_err) {
      throw new Error(`shell.openPath failed for "${_app.target}": ${_err}`)
    }
    return
  }
  if (_app.kind === 'uwp') {
    await _execFileAsync('cmd.exe', ['/c', 'start', '""', _app.target], { windowsHide: true })
    return
  }
  if (_app.kind === 'app-bundle') {
    await _execFileAsync('open', [_app.target])
    return
  }
}

async function focusSpotify(): Promise<void> {
  const _spotify = await findSpotifyApp()
  // #region agent log
  writeAgentDebugLog('initial','H5,H6','src/main/spotifyControl.ts:focusSpotify','Spotify app discovery result',{found:Boolean(_spotify),kind:_spotify?.kind,nameLength:_spotify?.name.length ?? 0})
  // #endregion
  if (!_spotify) {
    throw new Error('Spotify is not installed or was not found in app discovery')
  }
  await launchDiscoveredApp(_spotify)
  await delay(1200)
}

async function openSpotifySearch(_query: string): Promise<void> {
  await focusSpotify()
  const _control = getKey(['LeftControl', 'Control', 'LeftCtrl'])
  const _l = getKey(['L'])
  const _a = getKey(['A'])
  const _enter = getKey(['Enter', 'Return'])
  // #region agent log
  writeAgentDebugLog('initial','H5','src/main/spotifyControl.ts:openSpotifySearch','Sending Spotify search keystrokes',{queryLength:_query.length,hasControl:Boolean(_control),hasL:Boolean(_l),hasA:Boolean(_a),hasEnter:Boolean(_enter)})
  // #endregion
  await pressShortcut(_control, _l)
  await delay(150)
  await pressShortcut(_control, _a)
  await keyboard.type(_query)
  await keyboard.pressKey(_enter)
  await keyboard.releaseKey(_enter)
}

async function findSpotifyElementCenterByName(
  _targetText: string
): Promise<{ x: number; y: number; name: string } | null> {
  if (process.platform !== 'win32') {
    return null
  }
  const _escapedTarget = _targetText.replace(/'/g, "''")
  const _script = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$target = '${_escapedTarget}'.ToLowerInvariant()
$process = Get-Process Spotify -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if (-not $process) { exit 0 }
$root = [System.Windows.Automation.AutomationElement]::FromHandle($process.MainWindowHandle)
if (-not $root) { exit 0 }
$all = $root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
foreach ($el in $all) {
  $name = [string]$el.Current.Name
  if ([string]::IsNullOrWhiteSpace($name)) { continue }
  if ($name.ToLowerInvariant().Contains($target)) {
    $rect = $el.Current.BoundingRectangle
    if ($rect.Width -gt 0 -and $rect.Height -gt 0) {
      [Console]::WriteLine(($([pscustomobject]@{
        name = $name
        x = [int]($rect.X + ($rect.Width / 2))
        y = [int]($rect.Y + ($rect.Height / 2))
      }) | ConvertTo-Json -Compress))
      exit 0
    }
  }
}
`
  const { stdout } = await _execFileAsync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', _script],
    { windowsHide: true, maxBuffer: 1024 * 1024 }
  )
  const _trimmed = stdout.trim()
  // #region agent log
  writeAgentDebugLog('initial','H6','src/main/spotifyControl.ts:findSpotifyElementCenterByName','Spotify UI Automation lookup completed',{targetLength:_targetText.length,hasMatch:_trimmed.length>0,rawLength:_trimmed.length})
  // #endregion
  if (!_trimmed) {
    return null
  }
  return JSON.parse(_trimmed) as { x: number; y: number; name: string }
}

export async function searchSpotify(_query: string): Promise<string> {
  const _q = _query.trim()
  if (!_q) {
    throw new Error('spotify_search requires a non-empty query')
  }
  await openSpotifySearch(_q)
  return `Searched Spotify for "${_q}"`
}

export async function selectSpotifyTarget(
  _targetText?: string,
  _targetIndex?: number,
  _targetKind?: SpotifyTargetKind
): Promise<string> {
  const _query = _targetText?.trim()
  if (_query) {
    await openSpotifySearch(_query)
    await delay(900)
    const _match = await findSpotifyElementCenterByName(_query)
    if (_match) {
      // #region agent log
      writeAgentDebugLog('initial','H6','src/main/spotifyControl.ts:selectSpotifyTarget','Spotify UI Automation match selected',{matchNameLength:_match.name.length,x:_match.x,y:_match.y})
      // #endregion
      await mouse.setPosition({ x: _match.x, y: _match.y })
      await mouse.leftClick()
      const _kind = _targetKind && _targetKind !== 'unknown' ? `${_targetKind} ` : ''
      return `Selected Spotify ${_kind}"${_match.name}"`
    }
  } else {
    await focusSpotify()
  }

  const _down = getKey(['Down', 'ArrowDown'])
  const _enter = getKey(['Enter', 'Return'])
  const _steps = Math.max(0, (_targetIndex ?? 1) - 1)
  // #region agent log
  writeAgentDebugLog('initial','H6','src/main/spotifyControl.ts:selectSpotifyTarget','Spotify fallback keyboard selection',{steps:_steps,hasQuery:Boolean(_query),targetKind:_targetKind})
  // #endregion
  for (let _i = 0; _i < _steps; _i++) {
    await keyboard.pressKey(_down)
    await keyboard.releaseKey(_down)
  }
  await keyboard.pressKey(_enter)
  await keyboard.releaseKey(_enter)

  const _kind = _targetKind && _targetKind !== 'unknown' ? `${_targetKind} ` : ''
  if (_query) {
    return `Selected Spotify ${_kind}"${_query}"`
  }
  return `Selected Spotify result ${_targetIndex ?? 1}`
}
