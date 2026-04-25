/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly RENDERER_VITE_VULTR_INFERENCE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
