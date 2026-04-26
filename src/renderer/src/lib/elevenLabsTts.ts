// ElevenLabs Text-to-Speech service.
//
// Calls the ElevenLabs /v1/text-to-speech REST endpoint to synthesise speech
// from a text string, then plays the returned MP3 audio through the browser's
// Audio API. Supports cancel() to stop in-flight audio immediately, and
// fetchElevenLabsVoices() to retrieve the account's available voices for the
// settings UI.

const ELEVENLABS_TTS_BASE = 'https://api.elevenlabs.io/v1/text-to-speech'
const ELEVENLABS_VOICES_ENDPOINT = 'https://api.elevenlabs.io/v1/voices'

export interface TtsVoiceSettings {
  stability: number
  similarityBoost: number
  style: number
  useSpeakerBoost: boolean
  speed: number
}

export interface TtsSpeakOptions {
  apiKey: string
  voiceId: string
  modelId: string
  voiceSettings: TtsVoiceSettings
}

export interface ElevenLabsVoice {
  voice_id: string
  name: string
  category: string
  labels: Record<string, string>
  preview_url: string | null
}

interface ElevenLabsVoicesResponse {
  voices: ElevenLabsVoice[]
}

export class ElevenLabsTtsService {
  private m_currentAudio: HTMLAudioElement | null = null
  private m_currentObjectUrl: string | null = null
  private m_abortController: AbortController | null = null

  cancel(): void {
    if (this.m_currentAudio) {
      this.m_currentAudio.pause()
      this.m_currentAudio.src = ''
      this.m_currentAudio = null
    }
    if (this.m_currentObjectUrl) {
      URL.revokeObjectURL(this.m_currentObjectUrl)
      this.m_currentObjectUrl = null
    }
    if (this.m_abortController) {
      this.m_abortController.abort()
      this.m_abortController = null
    }
  }

  async speak(_text: string, _options: TtsSpeakOptions): Promise<void> {
    this.cancel()

    if (!_options.apiKey) {
      throw new Error('missing-elevenlabs-api-key')
    }
    if (!_text.trim()) {
      return
    }

    const _controller = new AbortController()
    this.m_abortController = _controller

    const _url = `${ELEVENLABS_TTS_BASE}/${encodeURIComponent(_options.voiceId)}`
    const _body = {
      text: _text,
      model_id: _options.modelId,
      voice_settings: {
        stability: _options.voiceSettings.stability,
        similarity_boost: _options.voiceSettings.similarityBoost,
        style: _options.voiceSettings.style,
        use_speaker_boost: _options.voiceSettings.useSpeakerBoost,
        speed: _options.voiceSettings.speed
      },
      output_format: 'mp3_44100_128'
    }

    let _response: Response
    try {
      _response = await fetch(_url, {
        method: 'POST',
        headers: {
          'xi-api-key': _options.apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg'
        },
        body: JSON.stringify(_body),
        signal: _controller.signal
      })
    } catch (_err) {
      if ((_err as Error).name === 'AbortError') {
        return
      }
      throw new Error(
        `elevenlabs-tts-network-error: ${_err instanceof Error ? _err.message : String(_err)}`
      )
    }

    if (!_response.ok) {
      throw new Error(`elevenlabs-tts-error-${_response.status}`)
    }

    if (_controller.signal.aborted) {
      return
    }

    const _blob = await _response.blob()

    if (_controller.signal.aborted) {
      return
    }

    const _objectUrl = URL.createObjectURL(_blob)
    this.m_currentObjectUrl = _objectUrl
    const _audio = new Audio(_objectUrl)
    this.m_currentAudio = _audio

    const cleanup = (): void => {
      URL.revokeObjectURL(_objectUrl)
      if (this.m_currentObjectUrl === _objectUrl) {
        this.m_currentObjectUrl = null
      }
      if (this.m_currentAudio === _audio) {
        this.m_currentAudio = null
      }
    }

    _audio.onended = cleanup
    _audio.onerror = cleanup

    try {
      await _audio.play()
    } catch (_err) {
      cleanup()
      if ((_err as Error).name !== 'AbortError') {
        throw _err
      }
    }
  }
}

export async function fetchElevenLabsVoices(_apiKey: string): Promise<ElevenLabsVoice[]> {
  if (!_apiKey) {
    return []
  }
  const _response = await fetch(ELEVENLABS_VOICES_ENDPOINT, {
    headers: { 'xi-api-key': _apiKey }
  })
  if (!_response.ok) {
    throw new Error(`elevenlabs-voices-error-${_response.status}`)
  }
  const _data = (await _response.json()) as ElevenLabsVoicesResponse
  return _data.voices ?? []
}
