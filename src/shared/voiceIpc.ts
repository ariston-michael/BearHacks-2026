/** IPC contract for voice intent execution (main process). */

export type VoiceIntentActionIn =
  | 'open_app'
  | 'search_web'
  | 'scroll_up'
  | 'scroll_down'
  | 'click'
  | 'unknown'

export interface VoiceExecuteIntentPayload {
  action: VoiceIntentActionIn
  query?: string
  appName?: string
  confidence: number
}

export interface VoiceExecuteIntentResult {
  ok: boolean
  message: string
}
