/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GAME_MODE?: "backend" | "midnight"
  readonly VITE_MIDNIGHT_STAKE?: string
  readonly VITE_MIDNIGHT_PAYOUT_ADDRESS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
