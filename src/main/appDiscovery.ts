// System app discovery for the smart launcher.
//
// Windows: walk Start Menu .lnk shortcuts (per-user + all-users) and
// invoke PowerShell `Get-StartApps` to capture UWP / packaged apps that
// don't appear as .lnk files. macOS: scan /Applications and
// /System/Applications for .app bundles. Results are cached in memory; the
// first call kicks off a background refresh on a TTL.

import { execFile } from 'node:child_process'
import { readdir, type Dirent } from 'node:fs'
import { promisify } from 'node:util'
import * as nodePath from 'node:path'
import { app } from 'electron'

const _execFileAsync = promisify(execFile)
const _readdirAsync = promisify(readdir)

async function readDirEntries(_dir: string): Promise<Dirent[]> {
  return _readdirAsync(_dir, { withFileTypes: true }) as unknown as Promise<Dirent[]>
}

export type DiscoveredAppKind = 'shortcut' | 'uwp' | 'app-bundle'

export interface DiscoveredApp {
  /** Display name shown in Start Menu / Finder. */
  name: string
  /** Either an absolute filesystem path (.lnk/.app) or a `shell:` URI for UWP. */
  target: string
  /** How we discovered it (drives launch strategy). */
  kind: DiscoveredAppKind
}

const CACHE_TTL_MS = 5 * 60_000

let m_cache: DiscoveredApp[] | null = null
let m_cacheLoadedAt = 0
let m_inflight: Promise<DiscoveredApp[]> | null = null

/**
 * Returns the current list of installed apps. Caches the result for
 * CACHE_TTL_MS; concurrent callers share a single in-flight refresh.
 */
export async function getInstalledApps(_forceRefresh = false): Promise<DiscoveredApp[]> {
  const _now = Date.now()
  if (!_forceRefresh && m_cache && _now - m_cacheLoadedAt < CACHE_TTL_MS) {
    return m_cache
  }
  if (m_inflight) {
    return m_inflight
  }
  m_inflight = (async (): Promise<DiscoveredApp[]> => {
    try {
      const _apps = await discoverApps()
      m_cache = _apps
      m_cacheLoadedAt = Date.now()
      return _apps
    } finally {
      m_inflight = null
    }
  })()
  return m_inflight
}

async function discoverApps(): Promise<DiscoveredApp[]> {
  if (process.platform === 'win32') {
    return discoverWindowsApps()
  }
  if (process.platform === 'darwin') {
    return discoverMacApps()
  }
  return []
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

async function discoverWindowsApps(): Promise<DiscoveredApp[]> {
  const _shortcuts = await scanWindowsStartMenuShortcuts()
  const _uwp = await scanWindowsUwpApps()
  return dedupeByName([..._shortcuts, ..._uwp])
}

function getWindowsStartMenuRoots(): string[] {
  const _roots: string[] = []
  const _appData = process.env['APPDATA']
  const _programData = process.env['PROGRAMDATA']
  if (_appData) {
    _roots.push(nodePath.join(_appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'))
  }
  if (_programData) {
    _roots.push(nodePath.join(_programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'))
  }
  return _roots
}

async function scanWindowsStartMenuShortcuts(): Promise<DiscoveredApp[]> {
  const _roots = getWindowsStartMenuRoots()
  const _results: DiscoveredApp[] = []
  for (const _root of _roots) {
    try {
      await walkLnkFiles(_root, (_lnkPath) => {
        const _base = nodePath.basename(_lnkPath, '.lnk')
        _results.push({ name: _base, target: _lnkPath, kind: 'shortcut' })
      })
    } catch {
      // ignore — root may not exist
    }
  }
  return _results
}

async function walkLnkFiles(
  _dir: string,
  _onLnk: (_filePath: string) => void
): Promise<void> {
  let _entries: Dirent[]
  try {
    _entries = await readDirEntries(_dir)
  } catch {
    return
  }
  for (const _entry of _entries) {
    const _full = nodePath.join(_dir, _entry.name)
    if (_entry.isDirectory()) {
      await walkLnkFiles(_full, _onLnk)
    } else if (_entry.isFile() && _entry.name.toLowerCase().endsWith('.lnk')) {
      _onLnk(_full)
    }
  }
}

interface StartAppsRow {
  Name?: string
  AppID?: string
}

async function scanWindowsUwpApps(): Promise<DiscoveredApp[]> {
  try {
    const { stdout } = await _execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-Command',
        'Get-StartApps | ConvertTo-Json -Compress'
      ],
      { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }
    )
    const _trimmed = stdout.trim()
    if (_trimmed.length === 0) {
      return []
    }
    const _parsed: StartAppsRow | StartAppsRow[] = JSON.parse(_trimmed)
    const _rows = Array.isArray(_parsed) ? _parsed : [_parsed]
    const _apps: DiscoveredApp[] = []
    for (const _row of _rows) {
      if (!_row?.Name || !_row?.AppID) {
        continue
      }
      _apps.push({
        name: _row.Name,
        target: `shell:AppsFolder\\${_row.AppID}`,
        kind: 'uwp'
      })
    }
    return _apps
  } catch (_err) {
    console.warn('[appDiscovery] Get-StartApps failed:', _err)
    return []
  }
}

// ---------------------------------------------------------------------------
// macOS
// ---------------------------------------------------------------------------

async function discoverMacApps(): Promise<DiscoveredApp[]> {
  const _roots = ['/Applications', '/System/Applications']
  const _results: DiscoveredApp[] = []
  for (const _root of _roots) {
    await walkAppBundles(_root, 0, (_appPath) => {
      const _base = nodePath.basename(_appPath, '.app')
      _results.push({ name: _base, target: _appPath, kind: 'app-bundle' })
    })
  }
  return dedupeByName(_results)
}

async function walkAppBundles(
  _dir: string,
  _depth: number,
  _onApp: (_appPath: string) => void
): Promise<void> {
  if (_depth > 3) {
    return
  }
  let _entries: Dirent[]
  try {
    _entries = await readDirEntries(_dir)
  } catch {
    return
  }
  for (const _entry of _entries) {
    if (!_entry.isDirectory()) {
      continue
    }
    const _full = nodePath.join(_dir, _entry.name)
    if (_entry.name.toLowerCase().endsWith('.app')) {
      _onApp(_full)
    } else {
      await walkAppBundles(_full, _depth + 1, _onApp)
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dedupeByName(_apps: DiscoveredApp[]): DiscoveredApp[] {
  const _seen = new Map<string, DiscoveredApp>()
  for (const _app of _apps) {
    const _key = _app.name.trim().toLowerCase()
    if (!_seen.has(_key)) {
      _seen.set(_key, _app)
    }
  }
  return Array.from(_seen.values()).sort((_a, _b) => _a.name.localeCompare(_b.name))
}

/**
 * Warm the cache once Electron is ready. Failures are logged, not thrown,
 * so they never block app startup.
 */
export function warmAppCacheWhenReady(): void {
  app
    .whenReady()
    .then(() => getInstalledApps(true))
    .then((_apps) => {
      console.log(`[appDiscovery] cached ${_apps.length} installed apps`)
    })
    .catch((_err) => {
      console.warn('[appDiscovery] warm cache failed:', _err)
    })
}
