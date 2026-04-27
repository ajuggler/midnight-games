import type { Direction } from "../compass"
import type { GameStateResponse, GameTransport, JoinResponse, PlayerSlot, SubmitGridInput } from "../gameTypes"
import {
  clearLocalIdentity,
  getConfiguredMidnightStake,
  getConfiguredPayoutAddress,
  getCounterfeitCompassAdapter,
  loadLocalIdentity,
  loadOrCreateLocalIdentity,
  saveLocalIdentity,
} from "./contract"
import {
  buildLocalBoard,
  clearLocalBoard,
  saveLocalBoard,
  type BoardCommitmentRuntime,
} from "./localBoard"
import { mapLedgerStateToGameState, mapMidnightPhaseToAppTag } from "./stateMapping"

function getNicknames(contractAddress: string): Partial<Record<PlayerSlot, string>> {
  const identity = loadLocalIdentity(contractAddress)
  if (!identity?.playerSlot) {
    return {}
  }

  return {
    [identity.playerSlot]: identity.nickname,
  }
}

function requireBoardRuntime<TPath>(): BoardCommitmentRuntime<TPath> {
  const adapter = getCounterfeitCompassAdapter()
  if (!adapter.boardRuntime) {
    throw new Error(
      "The Midnight adapter is missing boardRuntime. " +
        "Expose the generated persistentCommit and MerkleTree helpers before enabling Midnight mode."
    )
  }

  return adapter.boardRuntime as BoardCommitmentRuntime<TPath>
}

export async function queryGameState(): Promise<GameStateResponse> {
  const adapter = getCounterfeitCompassAdapter()
  const snapshot = await adapter.getLedgerState()
  return mapLedgerStateToGameState(snapshot, getNicknames(snapshot.contractAddress))
}

export async function joinGameTx(input: {
  nickname: string
}): Promise<JoinResponse> {
  const adapter = getCounterfeitCompassAdapter()
  const identity = loadOrCreateLocalIdentity(adapter.contractAddress, input.nickname)
  const result = await adapter.joinGame({
    nickname: input.nickname,
    stake: getConfiguredMidnightStake(),
    payoutAddress: getConfiguredPayoutAddress(),
    localSecretKey: identity.secretKey,
  })

  saveLocalIdentity(adapter.contractAddress, {
    ...identity,
    playerSlot: result.slot,
  })

  return {
    slot: result.slot,
    phase: {
      tag: mapMidnightPhaseToAppTag(result.phase),
    },
  }
}

export async function commitBoardTx(input: SubmitGridInput): Promise<void> {
  const adapter = getCounterfeitCompassAdapter()
  const identity = loadLocalIdentity(adapter.contractAddress)

  if (!identity?.playerSlot || !input.playerSlot) {
    throw new Error("Join the Midnight game before committing a board.")
  }

  const runtime = requireBoardRuntime<unknown>()
  const board = await buildLocalBoard(input.directions, runtime)
  saveLocalBoard(adapter.contractAddress, input.playerSlot, board)

  for (let index = 0; index < board.dirs.length; index += 1) {
    await adapter.commitMyNextBoardCell({
      index,
      board,
    })
  }
}

export async function finalizeBoardTx(): Promise<void> {
  const adapter = getCounterfeitCompassAdapter()
  await adapter.finalizeMyBoard()
}

export async function playTx(direction: Direction): Promise<void> {
  const adapter = getCounterfeitCompassAdapter()
  await adapter.play({
    reading: direction,
  })
}

export async function challengeTx(): Promise<void> {
  const adapter = getCounterfeitCompassAdapter()
  await adapter.challenge()
}

export async function proveMyReadingTx(): Promise<void> {
  const adapter = getCounterfeitCompassAdapter()
  await adapter.proveMyReading()
}

export async function claimPotTx(): Promise<void> {
  const adapter = getCounterfeitCompassAdapter()
  await adapter.claimPot()
}

export async function clearMidnightLocalState(): Promise<void> {
  const adapter = getCounterfeitCompassAdapter()
  const identity = loadLocalIdentity(adapter.contractAddress)
  if (identity?.playerSlot) {
    clearLocalBoard(adapter.contractAddress, identity.playerSlot)
  }
  clearLocalIdentity(adapter.contractAddress)
}

export function createMidnightTransport(): GameTransport {
  return {
    mode: "midnight",
    label: "Midnight mode",
    description:
      "Public state is expected to come from a Midnight contract. Private board data lives only in this browser and is used as witness material.",
    showsPrivateBoardNotice: true,
    canResetGame: false,
    canForceReset: true,
    canClaimPot: true,
    getState: queryGameState,
    joinGame: (input) => joinGameTx({ nickname: input.nickname }),
    submitGrid: async (input) => {
      await commitBoardTx(input)
      await finalizeBoardTx()
    },
    submitReading: playTx,
    submitChallenge: challengeTx,
    submitProof: proveMyReadingTx,
    claimPot: claimPotTx,
    resetGame: async () => {
      throw new Error(
        "Midnight games are intended to use a fresh contract instance per match. Deploy or connect to a new contract to play again."
      )
    },
    forceReset: clearMidnightLocalState,
  }
}
