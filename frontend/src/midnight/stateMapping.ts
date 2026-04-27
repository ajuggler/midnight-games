import type { Direction } from "../compass"
import type { GameStateResponse, PhaseTag, PlayerSlot } from "../gameTypes"
import type { MidnightLedgerSnapshot, MidnightPhase } from "./contract"

function mapPhase(
  phase: MidnightPhase,
  winner: PlayerSlot | null
): GameStateResponse["phase"] {
  switch (phase) {
    case "OPEN":
      return { tag: "StandBy" }
    case "WAITING_FOR_SECOND_PLAYER":
      return { tag: "WaitingForSecondPlayer" }
    case "WAITING_FOR_BOARDS":
      return { tag: "WaitingForGridsSetup" }
    case "IN_PROGRESS":
      return { tag: "InProgress" }
    case "FINISHED":
    case "PAID":
      return { tag: "Finished", winner: winner ?? "A" }
  }
}

function toDirection(value: number | undefined, present: boolean): Direction | undefined {
  if (!present || value === undefined) {
    return undefined
  }

  return value as Direction
}

export function mapMidnightPhaseToAppTag(phase: MidnightPhase): PhaseTag {
  return mapPhase(phase, null).tag
}

export function mapLedgerStateToGameState(
  snapshot: MidnightLedgerSnapshot,
  nicknames?: Partial<Record<PlayerSlot, string>>
): GameStateResponse {
  const phase = mapPhase(snapshot.phase, snapshot.winner)
  const isStarted = snapshot.phase === "IN_PROGRESS" || snapshot.phase === "FINISHED" || snapshot.phase === "PAID"
  const positions = isStarted &&
    snapshot.rowA !== undefined &&
    snapshot.colA !== undefined &&
    snapshot.rowB !== undefined &&
    snapshot.colB !== undefined
    ? {
        A: [snapshot.rowA, snapshot.colA] as [number, number],
        B: [snapshot.rowB, snapshot.colB] as [number, number],
      }
    : undefined
  const charges = isStarted &&
    snapshot.chargeA !== undefined &&
    snapshot.chargeB !== undefined
    ? {
        A: snapshot.chargeA,
        B: snapshot.chargeB,
      }
    : undefined

  return {
    phase,
    players: {
      A: snapshot.playerAKey ? { nickname: nicknames?.A ?? "Player A" } : undefined,
      B: snapshot.playerBKey ? { nickname: nicknames?.B ?? "Player B" } : undefined,
    },
    lastReadings: {
      A: toDirection(snapshot.readingA, snapshot.hasReadingA),
      B: toDirection(snapshot.readingB, snapshot.hasReadingB),
    },
    positions,
    charges,
    turn:
      snapshot.phase === "IN_PROGRESS" && snapshot.turnPlayer
        ? {
            player: snapshot.turnPlayer,
            challenged: snapshot.challenged,
          }
        : undefined,
  }
}
