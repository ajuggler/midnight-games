import { createBackendTransport } from "./backendTransport"
import { createMidnightTransport } from "./midnight/transactions"

const requestedMode = import.meta.env.VITE_GAME_MODE === "midnight"
  ? "midnight"
  : "backend"

export const gameTransport =
  requestedMode === "midnight"
    ? createMidnightTransport()
    : createBackendTransport()
