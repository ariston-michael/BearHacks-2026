/** IPC contract for voice intent execution (main process). */

export type VoiceIntentActionIn =
  | 'open_app'
  | 'open_url'
  | 'open_app_with_query'
  | 'search_web'
  | 'scroll_up'
  | 'scroll_down'
  | 'click'
  | 'unknown'

export interface VoiceExecuteIntentPayload {
  action: VoiceIntentActionIn
  query?: string
  appName?: string
  /** Absolute URL to open (used by `open_url`). */
  url?: string
  confidence: number
}

export interface VoiceExecuteIntentResult {
  ok: boolean
  message: string
}
