/// <reference types="vite/client" />

import type { VoiceExecuteIntentPayload, VoiceExecuteIntentResult } from '../../shared/voiceIpc'

declare global {
  interface ImportMetaEnv {
    readonly RENDERER_VITE_ELEVENLABS_API_KEY?: string
    readonly RENDERER_VITE_VULTR_INFERENCE_KEY?: string
  }
  interface AirControlApi {
    voice: {
      executeIntent: (_payload: VoiceExecuteIntentPayload) => Promise<VoiceExecuteIntentResult>
    }
  }
  interface Window {
    readonly api: AirControlApi
  }
}

export {}
