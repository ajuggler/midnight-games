import { initialServerState } from "../logic/game"
import type { PlayerSession, ServerState } from "../types/game"

let serverState: ServerState = initialServerState()

const sessions = new Map<string, PlayerSession>()

export function getServerState(): ServerState {
  return serverState
}

export function setServerState(state: ServerState): void {
  serverState = state
}

export function getSession(sessionId: string): PlayerSession | null {
  return sessions.get(sessionId) ?? null
}

export function setSession(playerSession: PlayerSession): void {
  sessions.set(playerSession.sessionId, playerSession)
}

export function clearSessions(): void {
  sessions.clear()
}
