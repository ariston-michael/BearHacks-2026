// Smart voice-command resolver.
//
// Given a parsed VoiceExecuteIntentPayload from Gemma, decide what to actually
// do on the host machine:
//   - open_app             -> fuzzy match against discovered installed apps
//                             (Start Menu shortcuts + UWP + macOS bundles).
//                             Fallback: Google search for the spoken name.
//   - open_url             -> open the supplied URL in Chrome (or default).
//   - search_web           -> Google search the query (via Chrome).
//   - open_app_with_query  -> if a known web alias, route to its search URL;
//                             otherwise launch the app, focus it, and type
//                             the query via the keyboard.
//
// Everything in this module runs in the Electron main process.

import { execFile, spawn } from 'node:child_process'
import * as fsPromises from 'node:fs/promises'
import * as nodePath from 'node:path'
import { promisify } from 'node:util'
import { app, shell } from 'electron'
import Fuse from 'fuse.js'
import { keyboard, Key } from '@nut-tree-fork/nut-js'
import { getInstalledApps, type DiscoveredApp } from './appDiscovery'
import { CHROME_DEBUG_PORT, selectVisibleLink } from './chromeTabs'
import { answerCurrentPageQuestion } from './pageContext'
import { searchSpotify, selectSpotifyTarget } from './spotifyControl'
import { writeAgentDebugLog } from './agentDebugLog'
import type { VoiceExecuteIntentPayload, VoiceExecuteIntentResult } from '../shared/voiceIpc'

const _execFileAsync = promisify(execFile)

// fuse.js fuzziness threshold. 0.0 = exact match required, 1.0 = match anything.
// 0.45 is a reasonable middle ground that still catches typos / phonetic
// transcription drift like "discored" -> "Discord".
const FUSE_THRESHOLD = 0.45

// ---------------------------------------------------------------------------
// Web aliases — these are spoken app names that should always route to a URL
// rather than try to launch a desktop binary, plus an optional query template
// for the open_app_with_query path.
// ---------------------------------------------------------------------------

interface WebAlias {
  homepage: string
  /** Optional URL template; `{q}` is replaced by the URL-encoded query. */
  searchTemplate?: string
}

const WEB_ALIASES: Record<string, WebAlias> = {
  google: {
    homepage: 'https://www.google.com',
    searchTemplate: 'https://www.google.com/search?q={q}'
  },
  youtube: {
    homepage: 'https://www.youtube.com',
    searchTemplate: 'https://www.youtube.com/results?search_query={q}'
  },
  gmail: { homepage: 'https://mail.google.com' },
  'google maps': {
    homepage: 'https://maps.google.com',
    searchTemplate: 'https://www.google.com/maps/search/{q}'
  },
  maps: {
    homepage: 'https://maps.google.com',
    searchTemplate: 'https://www.google.com/maps/search/{q}'
  },
  twitter: { homepage: 'https://twitter.com' },
  x: { homepage: 'https://x.com' },
  reddit: {
    homepage: 'https://www.reddit.com',
    searchTemplate: 'https://www.reddit.com/search/?q={q}'
  },
  github: {
    homepage: 'https://github.com',
    searchTemplate: 'https://github.com/search?q={q}'
  },
  wikipedia: {
    homepage: 'https://www.wikipedia.org',
    searchTemplate: 'https://en.wikipedia.org/wiki/Special:Search?search={q}'
  },
  amazon: {
    homepage: 'https://www.amazon.com',
    searchTemplate: 'https://www.amazon.com/s?k={q}'
  },
  netflix: { homepage: 'https://www.netflix.com' },
  spotify: {
    homepage: 'https://open.spotify.com',
    searchTemplate: 'https://open.spotify.com/search/{q}'
  },
  'chat gpt': { homepage: 'https://chat.openai.com' },
  chatgpt: { homepage: 'https://chat.openai.com' }
}

function lookupWebAlias(_name: string): WebAlias | null {
  const _key = _name.toLowerCase().trim()
  if (WEB_ALIASES[_key]) {
    return WEB_ALIASES[_key]
  }
  for (const _aliasKey of Object.keys(WEB_ALIASES)) {
    if (_key.includes(_aliasKey)) {
      return WEB_ALIASES[_aliasKey] ?? null
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Chrome detection / URL opening
// ---------------------------------------------------------------------------

async function getChromeAutomationUserDataDir(): Promise<string> {
  const _dir = nodePath.join(app.getPath('userData'), 'chrome-automation-profile')
  await fsPromises.mkdir(_dir, { recursive: true })
  return _dir
}

async function findChromeExecutable(): Promise<string | null> {
  if (process.platform === 'win32') {
    const _candidates = [
      process.env['LOCALAPPDATA']
        ? nodePath.join(process.env['LOCALAPPDATA'], 'Google', 'Chrome', 'Application', 'chrome.exe')
        : null,
      process.env['PROGRAMFILES']
        ? nodePath.join(process.env['PROGRAMFILES'], 'Google', 'Chrome', 'Application', 'chrome.exe')
        : null,
      process.env['PROGRAMFILES(X86)']
        ? nodePath.join(
            process.env['PROGRAMFILES(X86)'],
            'Google',
            'Chrome',
            'Application',
            'chrome.exe'
          )
        : null
    ].filter((_p): _p is string => typeof _p === 'string')
    for (const _candidate of _candidates) {
      try {
        await fsPromises.access(_candidate)
        return _candidate
      } catch {
        // not present, try next
      }
    }
    return null
  }
  if (process.platform === 'darwin') {
    const _candidate = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    try {
      await fsPromises.access(_candidate)
      return _candidate
    } catch {
      return null
    }
  }
  return null
}

/**
 * Open a URL in Chrome if available; fall back to the OS default browser.
 */
export async function openInChrome(_url: string): Promise<{ via: 'chrome' | 'default' }> {
  const _chrome = await findChromeExecutable()
  if (_chrome) {
    const _userDataDir = await getChromeAutomationUserDataDir()
    const _args = [
      `--remote-debugging-port=${CHROME_DEBUG_PORT}`,
      `--user-data-dir=${_userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      _url
    ]
    if (process.platform === 'darwin') {
      await _execFileAsync('open', [
        '-a',
        'Google Chrome',
        '--args',
        ..._args
      ])
    } else {
      const _child = spawn(_chrome, _args, { detached: true, stdio: 'ignore' })
      _child.unref()
    }
    return { via: 'chrome' }
  }
  await shell.openExternal(_url)
  return { via: 'default' }
}

// ---------------------------------------------------------------------------
// Fuzzy matching against installed apps
// ---------------------------------------------------------------------------

let m_fuseCache: { apps: DiscoveredApp[]; fuse: Fuse<DiscoveredApp> } | null = null

function getFuse(_apps: DiscoveredApp[]): Fuse<DiscoveredApp> {
  if (m_fuseCache && m_fuseCache.apps === _apps) {
    return m_fuseCache.fuse
  }
  const _fuse = new Fuse(_apps, {
    keys: ['name'],
    threshold: FUSE_THRESHOLD,
    ignoreLocation: true,
    includeScore: true,
    shouldSort: true
  })
  m_fuseCache = { apps: _apps, fuse: _fuse }
  return _fuse
}

async function findBestApp(_name: string): Promise<DiscoveredApp | null> {
  const _apps = await getInstalledApps()
  if (_apps.length === 0) {
    return null
  }
  const _fuse = getFuse(_apps)
  const _results = _fuse.search(_name, { limit: 1 })
  if (_results.length === 0) {
    return null
  }
  return _results[0].item
}

// ---------------------------------------------------------------------------
// Launching
// ---------------------------------------------------------------------------

async function launchDiscoveredApp(_app: DiscoveredApp): Promise<void> {
  if (_app.kind === 'shortcut') {
    const _err = await shell.openPath(_app.target)
    if (_err) {
      throw new Error(`shell.openPath failed for "${_app.target}": ${_err}`)
    }
    return
  }
  if (_app.kind === 'uwp') {
    if (process.platform !== 'win32') {
      throw new Error('UWP launch is only supported on Windows')
    }
    // `start "" shell:AppsFolder\<AppID>` is the standard incantation.
    await _execFileAsync(
      'cmd.exe',
      ['/c', 'start', '""', _app.target],
      { windowsHide: true }
    )
    return
  }
  if (_app.kind === 'app-bundle') {
    await _execFileAsync('open', [_app.target])
    return
  }
  throw new Error(`Unknown app kind: ${(_app as DiscoveredApp).kind}`)
}

async function typeQueryAfterLaunch(_query: string): Promise<void> {
  // Wait briefly so the launched app can take focus before we type.
  await new Promise((_resolve) => setTimeout(_resolve, 1200))
  try {
    await keyboard.type(_query)
    await keyboard.pressKey(Key.Enter)
    await keyboard.releaseKey(Key.Enter)
  } catch (_err) {
    console.warn('[voiceCommands] typeQueryAfterLaunch failed:', _err)
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function resolveAndLaunch(
  _payload: VoiceExecuteIntentPayload
): Promise<VoiceExecuteIntentResult> {
  try {
    // #region agent log
    writeAgentDebugLog('initial','H3,H4,H5,H6','src/main/voiceCommands.ts:resolveAndLaunch','Main resolver received voice action',{action:_payload.action,hasLinkIndex:_payload.linkIndex!==undefined,hasLinkText:Boolean(_payload.linkText?.trim()),hasTargetIndex:_payload.targetIndex!==undefined,hasTargetText:Boolean(_payload.targetText?.trim()),targetKind:_payload.targetKind,confidence:_payload.confidence})
    // #endregion
    if (_payload.action === 'search_web') {
      const _q = (_payload.query ?? '').trim()
      if (_q.length === 0) {
        return { ok: false, message: 'search_web requires non-empty query' }
      }
      const _url = `https://www.google.com/search?q=${encodeURIComponent(_q)}`
      const { via } = await openInChrome(_url)
      return { ok: true, message: `Searched Google for "${_q}" (via ${via})` }
    }

    if (_payload.action === 'open_url') {
      const _url = (_payload.url ?? '').trim()
      if (_url.length === 0) {
        return { ok: false, message: 'open_url requires url' }
      }
      const { via } = await openInChrome(_url)
      return { ok: true, message: `Opened ${_url} (via ${via})` }
    }

    if (_payload.action === 'select_link') {
      const _linkIndex = _payload.linkIndex
      const _linkText = (_payload.linkText ?? '').trim()
      if (_linkIndex === undefined && _linkText.length === 0) {
        return { ok: false, message: 'select_link requires linkIndex or linkText' }
      }
      const { link, pageTitle } = await selectVisibleLink(
        _linkIndex,
        _linkText.length > 0 ? _linkText : undefined
      )
      return {
        ok: true,
        message: `Opened link ${link.index} on "${pageTitle}": ${link.text}`
      }
    }

    if (_payload.action === 'page_question') {
      const _query = (_payload.query ?? '').trim()
      const _anchorText = (_payload.anchorText ?? '').trim()
      if (_query.length === 0 && _anchorText.length === 0) {
        return { ok: false, message: 'page_question requires query or anchorText' }
      }
      const _answer = await answerCurrentPageQuestion(
        _query,
        _anchorText.length > 0 ? _anchorText : undefined
      )
      return { ok: true, message: `${_answer.answer} (${_answer.pageTitle})` }
    }

    if (_payload.action === 'spotify_search') {
      const _query = (_payload.query ?? '').trim()
      if (_query.length === 0) {
        return { ok: false, message: 'spotify_search requires query' }
      }
      return { ok: true, message: await searchSpotify(_query) }
    }

    if (_payload.action === 'spotify_select') {
      const _targetText = (_payload.targetText ?? '').trim()
      const _targetIndex = _payload.targetIndex
      if (_targetText.length === 0 && _targetIndex === undefined) {
        return { ok: false, message: 'spotify_select requires targetText or targetIndex' }
      }
      return {
        ok: true,
        message: await selectSpotifyTarget(
          _targetText.length > 0 ? _targetText : undefined,
          _targetIndex,
          _payload.targetKind
        )
      }
    }

    if (_payload.action === 'open_app') {
      const _name = (_payload.appName ?? '').trim()
      if (_name.length === 0) {
        return { ok: false, message: 'open_app requires appName' }
      }
      const _match = await findBestApp(_name)
      if (_match) {
        await launchDiscoveredApp(_match)
        return { ok: true, message: `Launched ${_match.name}` }
      }

      const _alias = lookupWebAlias(_name)
      if (_alias) {
        const { via } = await openInChrome(_alias.homepage)
        return { ok: true, message: `Opened ${_name} (${_alias.homepage}, via ${via})` }
      }

      const _fallback = `https://www.google.com/search?q=${encodeURIComponent(_name)}`
      const { via } = await openInChrome(_fallback)
      return {
        ok: true,
        message: `App "${_name}" not found locally — opened Google search instead (via ${via})`
      }
    }

    if (_payload.action === 'open_app_with_query') {
      const _name = (_payload.appName ?? '').trim()
      const _query = (_payload.query ?? '').trim()
      if (_name.length === 0 || _query.length === 0) {
        return { ok: false, message: 'open_app_with_query requires appName and query' }
      }

      const _alias = lookupWebAlias(_name)
      if (_alias?.searchTemplate) {
        const _url = _alias.searchTemplate.replace('{q}', encodeURIComponent(_query))
        const { via } = await openInChrome(_url)
        return { ok: true, message: `Opened ${_name} search for "${_query}" (via ${via})` }
      }
      if (_alias) {
        const { via } = await openInChrome(_alias.homepage)
        return {
          ok: true,
          message: `Opened ${_name} (${_alias.homepage}, no search template, via ${via})`
        }
      }

      const _match = await findBestApp(_name)
      if (_match) {
        await launchDiscoveredApp(_match)
        await typeQueryAfterLaunch(_query)
        return { ok: true, message: `Launched ${_match.name} and typed: ${_query}` }
      }

      const _fallback = `https://www.google.com/search?q=${encodeURIComponent(`${_name} ${_query}`)}`
      const { via } = await openInChrome(_fallback)
      return {
        ok: true,
        message: `App "${_name}" not found — opened Google search for "${_name} ${_query}" (via ${via})`
      }
    }

    return { ok: false, message: `Action "${_payload.action}" is handled in the renderer` }
  } catch (_err) {
    const _message = _err instanceof Error ? _err.message : String(_err)
    return { ok: false, message: _message }
  }
}
