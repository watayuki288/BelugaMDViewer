import type { OrcaMdApi } from '@shared/types'

declare global {
  interface Window {
    api: OrcaMdApi
  }
}

export {}
