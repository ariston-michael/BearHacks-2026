/** IPC contract for voice intent execution (main process). */

export type VoiceIntentActionIn =
  | 'open_app'
  | 'open_url'
  | 'open_app_with_query'
  | 'search_web'
  | 'select_link'
  | 'page_question'
  | 'spotify_search'
  | 'spotify_select'
  | 'scroll_up'
  | 'scroll_down'
  | 'click'
  | 'unknown'

export type SpotifyTargetKind =
  | 'song'
  | 'album'
  | 'podcast'
  | 'artist'
  | 'playlist'
  | 'unknown'

export interface VoiceExecuteIntentPayload {
  action: VoiceIntentActionIn
  query?: string
  appName?: string
  /** Absolute URL to open (used by `open_url`). */
  url?: string
  /** 1-based visible link/result index for follow-up selection commands. */
  linkIndex?: number
  /** Spoken text identifying a visible link. */
  linkText?: string
  /** Phrase to locate inside current page text before answering. */
  anchorText?: string
  /** 1-based visible Spotify result index for follow-up selection commands. */
  targetIndex?: number
  /** Spoken text identifying a Spotify song/album/podcast/etc. */
  targetText?: string
  targetKind?: SpotifyTargetKind
  confidence: number
}

export interface VoiceExecuteIntentResult {
  ok: boolean
  message: string
}
